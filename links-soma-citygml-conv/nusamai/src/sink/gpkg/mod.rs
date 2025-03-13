//! GeoPackage sink

mod attributes;
mod bbox;
mod table;
use attributes::prepare_object_attributes;
use bbox::{get_indexed_multipolygon_bbox, Bbox};
use indexmap::IndexMap;
use nusamai_citygml::{
    object::{ObjectStereotype, Value},
    schema::Schema,
    GeometryType,
};
use nusamai_gpkg::{geometry::write_indexed_multipolygon, GpkgHandler};
use rayon::prelude::*;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::{collections::HashSet, path::PathBuf, time::Duration};
use table::schema_to_table_infos;
use std::thread;

use crate::{
    get_parameter_value,
    option::use_lod_config,
    parameters::*,
    pipeline::{Feedback, PipelineError, Receiver, Result},
    sink::{DataRequirements, DataSink, DataSinkProvider, SinkInfo},
    transformer,
    transformer::TransformerRegistry,
};
use std::fs::{self, File};
use std::io::{Write, BufReader, Read};
use zip::{write::FileOptions, CompressionMethod, ZipWriter};
use walkdir::WalkDir;

use super::option::output_parameter;
#[derive(Clone)]
struct FeatureData {
    table_name: String,
    geometry: Vec<u8>,
    attributes: IndexMap<String, String>,
}
pub struct GpkgSinkProvider {}

impl DataSinkProvider for GpkgSinkProvider {
    fn info(&self) -> SinkInfo {
        SinkInfo {
            id_name: "gpkg".to_string(),
            name: "GeoPackage".to_string(),
        }
    }

    fn sink_options(&self) -> Parameters {
        let mut params = Parameters::new();
        params.define(output_parameter());

        params
    }

    fn transformer_options(&self) -> TransformerRegistry {
        let mut settings: TransformerRegistry = TransformerRegistry::new();
        settings.insert(use_lod_config("all_lod"));

        settings
    }

    fn create(&self, params: &Parameters) -> Box<dyn DataSink> {
        let output_path = get_parameter_value!(params, "@output", FileSystemPath);
        let transform_settings = self.transformer_options();

        Box::<GpkgSink>::new(GpkgSink {
            output_path: output_path.as_ref().unwrap().into(),
            transform_settings,
        })
    }
}

pub struct GpkgSink {
    output_path: PathBuf,
    transform_settings: TransformerRegistry,
}

// An ephimeral container to wrap and pass the data in the pipeline
// Corresponds to a record in the features/attributes table of GeoPackage
enum Record {
    Feature {
        obj_id: String,
        geometry: Vec<u8>,
        bbox: Bbox,
        attributes: IndexMap<String, String>,
    },
    Attribute {
        attributes: IndexMap<String, String>,
    },
}

impl GpkgSink {
    pub async fn run_async(
        &mut self,
        upstream: Receiver,
        feedback: &Feedback,
        schema: &Schema,
    ) -> Result<()> {
        let table_infos = schema_to_table_infos(schema);
        let mut created_tables = HashSet::<String>::new();
        let srs_id = schema.epsg.unwrap_or(0); // 0 means 'Undefined Geographic'

        let mut table_bboxes = IndexMap::<String, Bbox>::new();

        let (sender, mut receiver) = tokio::sync::mpsc::channel(1000);

        let producers = {
            let feedback = feedback.clone();
            tokio::task::spawn_blocking(move || {
                upstream
                    .into_iter()
                    .par_bridge()
                    .try_for_each_with(sender, |sender, parcel| {
                        feedback.ensure_not_canceled()?;

                        let entity = parcel.entity;
                        let geom_store = entity.geometry_store.read().unwrap();

                        let Value::Object(obj) = &entity.root else {
                            return Ok(());
                        };

                        match &obj.stereotype {
                            ObjectStereotype::Feature {
                                id: obj_id,
                                geometries,
                            } => {
                                let mut mpoly = flatgeom::MultiPolygon::new();

                                geometries.iter().for_each(|entry| match entry.ty {
                                    GeometryType::Solid
                                    | GeometryType::Surface
                                    | GeometryType::Triangle => {
                                        for idx_poly in geom_store.multipolygon.iter_range(
                                            entry.pos as usize..(entry.pos + entry.len) as usize,
                                        ) {
                                            mpoly.push(&idx_poly);
                                        }
                                    }
                                    GeometryType::Curve => unimplemented!(),
                                    GeometryType::Point => unimplemented!(),
                                });

                                if mpoly.is_empty() {
                                    return Ok(());
                                }

                                let mut bytes = Vec::new();
                                if write_indexed_multipolygon(
                                    &mut bytes,
                                    &geom_store.vertices,
                                    &mpoly,
                                    4326,
                                )
                                .is_err()
                                {
                                    // TODO: fatal error
                                }

                                let table_name = obj.typename.to_string();
                                let record = Record::Feature {
                                    obj_id: obj_id.clone(),
                                    geometry: bytes,
                                    bbox: get_indexed_multipolygon_bbox(
                                        &geom_store.vertices,
                                        &mpoly,
                                    ),
                                    attributes: prepare_object_attributes(obj),
                                };
                                if sender.blocking_send((table_name, record)).is_err() {
                                    return Err(PipelineError::Canceled);
                                };
                            }
                            ObjectStereotype::Data => {
                                let table_name = obj.typename.to_string();
                                let record = Record::Attribute {
                                    attributes: prepare_object_attributes(obj),
                                };
                                if sender.blocking_send((table_name, record)).is_err() {
                                    return Err(PipelineError::Canceled);
                                };
                            }
                            ObjectStereotype::Object { id: obj_id } => {
                                // TODO: implement (you will also need the corresponding TypeDef::Object in the schema)
                                feedback.warn(format!(
                                    "ObjectStereotype::Object is not supported yet: id = {}",
                                    obj_id
                                ));
                            }
                        }

                        Ok(())
                    })
            })
        };

        let mut merged_data: HashMap<String, FeatureData> = HashMap::new();
        let mut records = Vec::new();
        let mut handlers: HashMap<String, GpkgHandler> = HashMap::new();
        let mut output_path_init = PathBuf::new();

        let mut path_delete = PathBuf::from(&self.output_path);
        path_delete = path_delete.join("PLATEAU.zip");

        if path_delete.exists() {
            if let Err(e) = fs::remove_file(&path_delete) {
                eprintln!("Error deleting directory: {}", e);
            }
        }

        while let Some((table_name, record)) = receiver.recv().await {
            feedback.ensure_not_canceled()?;

            if !created_tables.contains(&table_name) {
                let tf = table_infos.get(&table_name).unwrap();
                if tf.has_geometry {
                    let filename = Self::convert_filename(&table_name);
                    if filename != "PLATEAUurf" {
                        let mut path = PathBuf::from(&self.output_path);

                        if !path.exists() {
                            if let Err(e) = fs::create_dir(&path) {
                                eprintln!("Failed to create directory: {}", e);
                            }
                        }
                        if output_path_init.as_os_str().is_empty() {
                            output_path_init = path.clone();
                        }
                        if let Some(_stem) = path.file_stem() {
                            let new_filename = format!("{}.gpkg", filename);
                            path = path.join(new_filename);
                        }

                        let conn_str = format!("file:{}", path.to_string_lossy());

                        if path.exists() {
                            std::fs::remove_file(&path)?;
                        };

                        if !handlers.contains_key(&table_name) {
                            let new_handler = GpkgHandler::from_str(&conn_str)
                                .await
                                .expect("Failed to connect GpkgHandler");

                            handlers.insert(table_name.clone(), new_handler);
                        }

                        let handler = handlers.get_mut(&table_name).unwrap();

                        let mut tx = handler
                            .begin()
                            .await
                            .map_err(|e| PipelineError::Other(e.to_string()))?;

                        tx.add_table(tf, srs_id)
                            .await
                            .map_err(|e| PipelineError::Other(e.to_string()))?;

                        tx.commit()
                            .await
                            .map_err(|e| PipelineError::Other(e.to_string()))?;

                        created_tables.insert(table_name.clone());
                    }
                }
            }

            records.push((table_name, record));
        }

        records.sort_by(|(_, record_a), (_, record_b)| match (record_a, record_b) {
            (Record::Feature { .. }, Record::Attribute { .. }) => std::cmp::Ordering::Less,
            (Record::Attribute { .. }, Record::Feature { .. }) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        });

        feedback.info("GPKG data processing...".into());

        for (table_name, record) in records {
            match record {
                Record::Feature {
                    obj_id,
                    geometry,
                    bbox,
                    mut attributes,
                } => {
                    table_bboxes
                        .entry(table_name.clone())
                        .and_modify(|b| b.merge(&bbox))
                        .or_insert(bbox);

                    attributes = Self::process_all_values(attributes);
                    let flattened_attributes = Self::flatten_generic_attribute(attributes);
                    merged_data.insert(
                        obj_id.clone(),
                        FeatureData {
                            table_name,
                            geometry,
                            attributes: flattened_attributes,
                        },
                    );
                }
                Record::Attribute { mut attributes } => {
                    if let Some(parent_id) = attributes.get("parentId") {
                        if let Some(feature_data) = merged_data.get_mut(parent_id) {
                            attributes.shift_remove("parentId");
                            attributes.shift_remove("parentType");
                    
                            let category = if created_tables.contains("bldg:Building") {
                                Some("Building")
                            } else if created_tables.contains("wtr:WaterBody") {
                                Some("WaterBody")
                            } else if created_tables.contains("tran:Road") {
                                Some("Road")
                            } else {
                                None
                            };
                    
                            if let Some(_cat) = category {
                                if !matches!(
                                    table_name.as_str(),
                                    "uro:BuildingIDAttribute"
                                        | "uro:DataQualityAttribute"
                                        | "uro:BuildingDetailAttribute"
                                        | "uro:WaterBodyDetailAttribute"
                                        | "uro:RoadStructureAttribute"
                                ) {
                                    Self::rename_all_attributes(
                                        &mut attributes,
                                        table_name.split(':').last().unwrap_or(""),
                                        "",
                                        &created_tables.clone(),
                                    );
                                }
                            } else {
                                Self::rename_all_attributes(
                                    &mut attributes,
                                    table_name.split(':').last().unwrap_or(""),
                                    "",
                                    &created_tables.clone(),
                                );
                            }
                    
                            attributes = Self::process_all_values(attributes);
                    
                            for (key, value) in attributes {
                                feature_data.attributes.entry(key).or_insert(value);
                            }
                        }
                    }
                    
                }
            }
        }

        let mut table_features: HashMap<String, Vec<(String, FeatureData)>> = HashMap::new();

        // Group data by table_name
        for (obj_id, feature_data) in &mut merged_data {
            table_features
                .entry(feature_data.table_name.clone())
                .or_insert_with(Vec::new)
                .push((obj_id.clone(), feature_data.clone()));
        }

        // Process one table at a time
        for (table_name, features) in table_features {
            let handler = handlers.get_mut(&table_name).unwrap();
            let mut tx = handler
                .begin()
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;

            let columns = tx
                .get_columns(&table_name)
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;

            let mut all_missing_columns = HashSet::new();

            for (_, feature_data) in &features {
                let attribute_columns: HashSet<String> =
                    feature_data.attributes.keys().cloned().collect();
                let missing_columns: HashSet<_> =
                    attribute_columns.difference(&columns).cloned().collect();
                all_missing_columns.extend(missing_columns);
            }

            if !all_missing_columns.is_empty() {
                tx.alter_table_add_columns(&table_name, &all_missing_columns)
                    .await
                    .map_err(|e| PipelineError::Other(e.to_string()))?;
            }

            for (obj_id, feature_data) in features {
                tx.insert_feature(
                    &table_name,
                    &obj_id,
                    &feature_data.geometry,
                    &feature_data.attributes,
                )
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;
            }

            tx.commit()
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;
        }

        for (table_name, bbox) in &table_bboxes {
            feedback.ensure_not_canceled()?;

            let handler = handlers.get_mut(table_name).unwrap();
            let mut tx = handler
                .begin()
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;

            tx.update_bbox(&table_name, bbox.to_tuple())
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;

            tx.commit()
                .await
                .map_err(|e| PipelineError::Other(e.to_string()))?;
        }

        for handler in handlers.values() {
            handler.close().await;
        }

        let _ = Self::zip_folder(output_path_init);

        feedback.info("Complete processing".into());

        match producers.await.unwrap() {
            Ok(_) | Err(PipelineError::Canceled) => Ok(()),
            error @ Err(_) => error,
        }
    }

    fn zip_folder(src_folder: PathBuf) -> std::io::Result<()> {
        let zip_file_path = src_folder.join("PLATEAU.zip");
        let zip_file = File::create(&zip_file_path)?;
        let mut zip = ZipWriter::new(zip_file);
    
        let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
        let buffer_size: usize = 5 * 1024 * 1024; // 5MB buffer
        let sleep_time = Duration::from_millis(500);
    
        for entry in WalkDir::new(&src_folder).max_depth(1) {
            let entry = entry?;
            let entry_path = entry.path();
    
            if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext == "gpkg") {
                let relative_path = entry_path.strip_prefix(&src_folder).unwrap();
                zip.start_file(relative_path.to_string_lossy(), options)?;
    
                let mut file = BufReader::new(File::open(entry_path)?);
                let mut buffer = vec![0; buffer_size];
    
                loop {
                    let bytes_read = file.read(&mut buffer)?;
                    if bytes_read == 0 {
                        break;
                    }
                    zip.write_all(&buffer[..bytes_read])?;
    
                    if bytes_read >= buffer_size {
                        thread::sleep(sleep_time);
                    }
                }
    
                fs::remove_file(entry_path)?;
            }
        }
    
        zip.finish()?; 
        Ok(())
    }

    fn rename_all_attributes(
        updated_attributes: &mut IndexMap<String, String>,
        table_name: &str,
        prefix: &str,
        created_tables: &HashSet<String>,
    ) {
        let is_building = created_tables.contains("bldg:Building");
        let is_waterbody = created_tables.contains("wtr:WaterBody");
    
        let risk_attributes = [
            "InlandFloodingRiskAttribute",
            "HighTideRiskAttribute",
            "LandSlideRiskAttribute",
            "ReservoirFloodingRiskAttribute",
            "RiverFloodingRiskAttribute",
            "TsunamiRiskAttribute",
        ];
    
        let (new_prefix, new_table_name) = if is_building && risk_attributes.contains(&table_name) {
            ("buildingDisasterRiskAttribute", format!("Building{}", table_name))
        } else if is_waterbody && risk_attributes.contains(&table_name) {
            ("floodingRiskAttribute", format!("WaterBody{}", table_name))
        } else {
            (prefix, table_name.to_string())
        };
    
        let keys_to_rename: Vec<String> = updated_attributes.keys().cloned().collect();
    
        for key in keys_to_rename {
            if let Some(value) = updated_attributes.shift_remove(&key) {
                let new_key = if new_prefix.is_empty() {
                    format!("{}|{}", new_table_name, key)
                } else {
                    format!("{}|{}|{}", new_prefix, new_table_name, key)
                };
                updated_attributes.insert(new_key, value);
            }
        }
    }

    fn convert_filename(table_name: &str) -> String {
        match table_name {
            "bldg:Building" => "PLATEAU建築物".to_string(),
            "luse:LandUse" => "PLATEAU土地利用".to_string(),
            "urf:UrbanPlanningArea" => "PLATEAU都市計画区域".to_string(),
            "urf:QuasiUrbanPlanningArea" => "PLATEAU準都市計画区域".to_string(),
            "urf:AreaClassification" => "PLATEAU区域区分".to_string(),
            "urf:DistrictsAndZones" => "PLATEAU地域地区".to_string(),
            "urf:UseDistrict" => "PLATEAU用途地域".to_string(),
            "urf:SpecialUseDistrict" => "PLATEAU特別用途地区".to_string(),
            "urf:SpecialUseRestrictionDistrict" => "PLATEAU特定用途制限地域".to_string(),
            "urf:ExceptionalFloorAreaRateDistrict" => "PLATEAU特例容積率適用地区".to_string(),
            "urf:HighRiseResidentialAttractionDistrict" => "PLATEAU高層住居誘導地区".to_string(),
            "urf:HeightControlDistrict" => "PLATEAU高度地区".to_string(),
            "urf:HighLevelUseDistrict" => "PLATEAU高度利用地区".to_string(),
            "urf:SpecifiedBlock" => "PLATEAU特定街区".to_string(),
            "urf:SpecialUrbanRenaissanceDistrict" => "PLATEAU都市再生特別地区".to_string(),
            "urf:HousingControlArea" => "PLATEAU居住調整地域".to_string(),
            "urf:ResidentialEnvironmentImprovementDistrict" => "PLATEAU居住環境向上用途誘導地区".to_string(),
            "urf:SpecialUseAttractionDistrict" => "PLATEAU特定用途誘導地区".to_string(),
            "urf:FirePreventionDistrict" => "PLATEAU防火地域又は準防火地域".to_string(),
            "urf:SpecifiedDisasterPreventionBlockImprovementZone" => "PLATEAU特定防災街区整備地区".to_string(),
            "urf:LandscapeZone" => "PLATEAU景観地区".to_string(),
            "urf:ScenicDistrict" => "PLATEAU風致地区".to_string(),
            "urf:ParkingPlaceDevelopmentZone" => "PLATEAU駐車場整備地区".to_string(),
            "urf:PortZone" => "PLATEAU臨港地区".to_string(),
            "urf:SpecialZoneForPreservationOfHistoricalLandscape" => "PLATEAU歴史的風土特別保存地区".to_string(),
            "urf:ZoneForPreservationOfHistoricalLandscape" => "PLATEAU風土保存地区".to_string(),
            "urf:GreenSpaceConservationDistrict" => "PLATEAU緑地保全地域".to_string(),
            "urf:SpecialGreenSpaceConservationDistrict" => "PLATEAU特別緑地保全地域".to_string(),
            "urf:TreePlantingDistrict" => "PLATEAU緑化地域".to_string(),
            "urf:DistributionBusinessZone" => "PLATEAU流通業務地区".to_string(),
            "urf:ProductiveGreenZone" => "PLATEAU生産緑地地区".to_string(),
            "urf:ConservationZoneForClustersOfTraditionalStructures" => "PLATEAU伝統的建造物群保存地区".to_string(),
            "urf:AircraftNoiseControlZoneurf:AircraftNoiseControlZone" => "PLATEAU防止特別地区".to_string(),
            "urf:ProjectPromotionArea" => "PLATEAU促進区域".to_string(),
            "urf:UrbanRedevelopmentPromotionArea" => "PLATEAU市街地再開発促進区域".to_string(),
            "urf:LandReadjustmentPromotionArea" => "PLATEAU土地区画整理促進区域".to_string(),
            "urf:ResidentialBlockConstructionPromotionArea" => "PLATEAU住宅街区整備促進区域".to_string(),
            "urf:LandReadjustmentPromotionAreasForCoreBusinessUrbanDevelopment" => "PLATEAU拠点業務市街地整備土地区画整理促進区域".to_string(),
            "urf:UnusedLandUsePromotionArea" => "PLATEAU遊休土地転換利用促進地区".to_string(),
            "urf:UrbanDisasterRecoveryPromotionArea" => "PLATEAU被災市街地復興推進地域".to_string(),
            "urf:UrbanFacility" => "PLATEAU都市施設".to_string(),
            "urf:TrafficFacility" => "PLATEAU交通施設".to_string(),
            "urf:OpenSpaceForPublicUse" => "PLATEAU公共空地".to_string(),
            "urf:SupplyFacility," => "PLATEAU供給施設及び処理施設".to_string(),
            "urf:TreatmentFacility" => "PLATEAU供給施設及び処理施設".to_string(),
            "urf:Waterway" => "PLATEAU水路".to_string(),
            "urf:EducationalAndCulturalFacility" => "PLATEAU教育文化施設".to_string(),
            "urf:MedicalFacility" => "PLATEAU医療施設及び社会福祉施設".to_string(),
            "urf:SocialWelfareFacility" => "PLATEAU医療施設及び社会福祉施設".to_string(),
            "urf:MarketsSlaughterhousesCrematoria" => "PLATEAU市場、と畜場、火葬場".to_string(),
            "urf:CollectiveHousingFacilities" => "PLATEAU一団地の住宅施設".to_string(),
            "urf:CollectiveGovernmentAndPublicOfficeFacilities" => "PLATEAU一団地の官公庁施設".to_string(),
            "urf:DistributionBusinessPark" => "PLATEAU流通業務団地".to_string(),
            "urf:CollectiveFacilitiesForTsunamiDisasterPrevention" => "PLATEAU一団地の津波防災拠点市街地形成施設".to_string(),
            "urf:CollectiveFacilitiesForReconstructionAndRevitalization" => "PLATEAU一団地の復興再生拠点市街地形成施設".to_string(),
            "urf:CollectiveFacilitiesForReconstruction" => "PLATEAU一団地の復興拠点市街地形成施設".to_string(),
            "urf:CollectiveUrbanDisasterPreventionFacilities" => "PLATEAU一団地の都市安全確保拠点施設".to_string(),
            "urf:UrbanFacilityStipulatedByCabinetOrder" => "PLATEAU政令で定める都市施設".to_string(),
            "urf:TelecommunicationFacility" => "PLATEAU電気通信施設".to_string(),
            "urf:WindProtectionFacility" => "PLATEAU防風施設".to_string(),
            "urf:FireProtectionFacility" => "PLATEAU防火施設".to_string(),
            "urf:TideFacility" => "PLATEAU防潮施設".to_string(),
            "urf:FloodPreventionFacility" => "PLATEAU防水施設".to_string(),
            "urf:SnowProtectionFacility" => "PLATEAU防雪施設".to_string(),
            "urf:SandControlFacility" => "PLATEAU防砂施設".to_string(),
            "urf:UrbanDevelopmentProject" => "PLATEAU市街地開発事業".to_string(),
            "urf:LandReadjustmentProject" => "PLATEAU土地区画整理事業".to_string(),
            "urf:NewHousingAndUrbanDevelopmentProject" => "PLATEAU新住宅市街地開発事業".to_string(),
            "urf:IndustrialParkDevelopmentProject" => "PLATEAU工業団地造成事業".to_string(),
            "urf:UrbanRedevelopmentProject" => "PLATEAU市街地再開発事業".to_string(),
            "urf:NewUrbanInfrastructureProject" => "PLATEAU新都市基盤整備事業".to_string(),
            "urf:ResidentialBlockConstructionProject" => "PLATEAU住宅街区整備事業".to_string(),
            "urf:DisasterPreventionBlockImprovementProject" => "PLATEAU防災街区整備事業".to_string(),
            "urf:UrbanRenewalProject" => "PLATEAU市街地改造事業".to_string(),
            "urf:ScheduledAreaForUrbanDevelopmentProject" => "PLATEAU市街地開発事業等の予定区域".to_string(),
            "urf:ScheduledAreaForNewHousingAndUrbanDevelopmentProjects" => "PLATEAU新住宅市街地開発事業の予定区域".to_string(),
            "urf:ScheduledAreaForIndustrialParkDevelopmentProjects" => "PLATEAU工業団地造成事業の予定区域".to_string(),
            "urf:ScheduledAreaForNewUrbanInfrastructureProjects" => "PLATEAU新都市基盤整備事業の予定区域".to_string(),
            "urf:ScheduledAreaForCollectiveHousingFacilities" => "PLATEAU一団地の住宅施設の予定区域".to_string(),
            "urf:ScheduledAreaForCollectiveGovernmentAndPublicOfficeFacilities" => "PLATEAU一団地の官公庁施設の予定区域".to_string(),
            "urf:ScheduledAreaForDistributionBusinessPark" => "PLATEAU流通業務団地の予定区域".to_string(),
            "urf:DistrictPlan" => "PLATEAU地区計画".to_string(),
            "urf:DistrictDevelopmentPlan" => "PLATEAU地区整備計画".to_string(),
            "urf:DistrictFacilityurf:DistrictFacility" => "PLATEAU地区施設".to_string(),
            "urf:RoadsideDistrictPlan" => "PLATEAU沿道地区計画".to_string(),
            "urf:RoadsideDistrictImprovementPlan" => "PLATEAU沿道地区整備計画".to_string(),
            "urf:RoadsideDistrictFacility" => "PLATEAU沿道地区施設".to_string(),
            "urf:RuralDistrictPlan" => "PLATEAU集落地区計画".to_string(),
            "urf:RuralDistrictImprovementPlan" => "PLATEAU集落地整備計画".to_string(),
            "urf:RuralDistrictFacility" => "PLATEAU集落施設".to_string(),
            "urf:HistoricSceneryMaintenanceAndImprovementDistrictPlan" => "PLATEAU歴史的風致維持向上地区計画".to_string(),
            "urf:DistrictImprovementPlanForHistoricSceneryMaintenanceAndImprovementDistrict" => "PLATEAU歴史的風致維持向上地区整備計画".to_string(),
            "urf:DisasterPreventionBlockImprovementZonePlan" => "PLATEAU防災街区整備地区計画".to_string(),
            "urf:SpecifiedBuildingZoneImprovementPlan" => "PLATEAU特定建築物地区整備計画".to_string(),
            "urf:DistrictImprovementPlanForDisasterPreventionBlockImprovementZonePlan" => "PLATEAU防災街区整備地区整備計画".to_string(),
            "urf:ZonalDisasterPreventionFacility" => "PLATEAU地区防災施設".to_string(),
            "urf:ThreeDimensionalExtent" => "PLATEAU立体的な範囲".to_string(),
            "urf:Boundary" => "PLATEAU境界".to_string(),
            "urf:UrbanFunctionAttractionArea" => "PLATEAU都市機能誘導区域".to_string(),
            "urf:ResidenceAttractionArea" => "PLATEAU居住誘導区域".to_string(),
            _ => format!("PLATEAU{}", table_name),
        }
    }

    fn flatten_generic_attribute(
        mut updated_attributes: IndexMap<String, String>,
    ) -> IndexMap<String, String> {
        if let Some(generic_attr_value) = updated_attributes.shift_remove("genericAttribute") {
            if let Ok(JsonValue::Object(mut generic_obj)) =
                serde_json::from_str::<JsonValue>(&generic_attr_value)
            {
                generic_obj.remove("type");
                for (key, value) in generic_obj {
                    if let Some(value_str) = value.as_str() {
                        updated_attributes.insert(key, value_str.to_string());
                    } else {
                        updated_attributes.insert(key, value.to_string());
                    }
                }
            }
        }
        updated_attributes
    }

    pub fn process_value(value: String) -> String {
        if let Ok(json) = serde_json::from_str::<JsonValue>(&value) {
            if let JsonValue::Array(arr) = json {
                if arr.len() == 1 {
                    if let Some(JsonValue::String(single_value)) = arr.get(0) {
                        return single_value.clone();
                    }
                }
            }
        }
        value
    }

    pub fn process_all_values(
        mut updated_attributes: IndexMap<String, String>,
    ) -> IndexMap<String, String> {
        for (_key, value) in updated_attributes.iter_mut() {
            *value = Self::process_value(value.to_string());
        }
        updated_attributes
    }
}
pub enum GpkgTransformOption {}

impl DataSink for GpkgSink {
    fn make_requirements(&mut self, properties: TransformerRegistry) -> DataRequirements {
        let default_requirements = DataRequirements {
            tree_flattening: transformer::TreeFlatteningSpec::Flatten {
                feature: transformer::FeatureFlatteningOption::AllExceptThematicSurfaces,
                data: transformer::DataFlatteningOption::TopLevelOnly,
                object: transformer::ObjectFlatteningOption::None,
            },
            ..Default::default()
        };

        for config in properties.configs.iter() {
            let _ = &self.transform_settings.update_transformer(config.clone());
        }

        self.transform_settings.build(default_requirements)
    }

    fn run(&mut self, upstream: Receiver, feedback: &Feedback, schema: &Schema) -> Result<()> {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(self.run_async(upstream, feedback, schema))
    }
}
