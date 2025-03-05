import { type Polygon } from "geojson";
import { geoJSONToWkt } from "betterknown";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
  data_set_results,
  type InsertDataSetDetailBuilding,
  type InsertDataSetResult,
} from "../schema";
import { db } from "../utils/db";
import { TOYOTA_AREAS } from "./dummy-area";
import { type IpcMainListener } from ".";

/** 開発用・実際にはアプリケーションからインサートすることはない */
export const createDataSetResults = (async (
  _: unknown,
  { title }: InsertDataSetResult,
): Promise<void> => {
  await db.transaction(async (tx) => {
    const res = await tx.insert(data_set_results).values({ title }).returning();
    await tx.insert(data_set_detail_areas).values({
      data_set_result_id: res[0].id,
      reference_date: "2021-01-01 12:00:00",
      geometry: geoJSONToWkt({
        type: "Polygon",
        coordinates: dummyAreaGeometry,
      }),
    });

    /** 開発用のテストデータ生成ロジック、本番環境では利用しない  */
    for (let i = 0; i < 5; i++) {
      const number_of_people_under_15_years_old = Math.floor(
        Math.random() * 10,
      );
      const number_of_people_aged_15_to_64 = Math.floor(Math.random() * 10);
      const number_of_people_aged_65_and_over = Math.floor(Math.random() * 10);
      const number_of_people_in_household =
        number_of_people_under_15_years_old +
        number_of_people_aged_15_to_64 +
        number_of_people_aged_65_and_over;
      const composition_ratio_of_people_aged_15_to_64 =
        (number_of_people_aged_15_to_64 / number_of_people_in_household) * 100;
      const composition_ratio_of_people_aged_65_and_over =
        (number_of_people_aged_65_and_over / number_of_people_in_household) *
        100;
      const composition_ratio_of_people_under_15_years_old =
        (number_of_people_under_15_years_old / number_of_people_in_household) *
        100;
      const number_of_male = Math.floor(
        Math.random() * number_of_people_in_household,
      );
      const number_of_female = number_of_people_in_household - number_of_male;
      const male_to_female_ratio = number_of_male / number_of_female;

      const pred = Math.random();
      const area_group =
        TOYOTA_AREAS[Math.floor(Math.random() * TOYOTA_AREAS.length)];
      const insertion: InsertDataSetDetailBuilding = {
        data_set_result_id: res[0].id,
        household_code: `1000000${i}`,
        normalized_address: `愛知県豊田市${area_group}${i}丁目`,
        area_group,
        reference_date: `202${i}-01-01`,
        household_size: number_of_people_in_household,
        members_under_15: number_of_people_under_15_years_old,
        percentage_under_15: composition_ratio_of_people_under_15_years_old,
        members_15_to_64: number_of_people_aged_15_to_64,
        percentage_15_to_64: composition_ratio_of_people_aged_15_to_64,
        members_over_65: number_of_people_aged_65_and_over,
        percentage_over_65: composition_ratio_of_people_aged_65_and_over,
        gender_ratio: male_to_female_ratio,
        residence_duration: Math.floor(Math.random() * 10),
        water_supply_number: `1000000${i}`,
        water_disconnection_flag: Math.round(Math.random()),
        max_water_usage: Math.floor(Math.random() * 100),
        avg_water_usage: Math.floor(Math.random() * 100),
        total_water_usage: Math.floor(Math.random() * 100),
        min_water_usage: Math.floor(Math.random() * 100),
        water_supply_source_info: `水道局${i}`,
        structure_name: `建物${i}`,
        registration_date: `202${i}-01-01`,
        registration_source_info: `登記所${i}`,
        vacant_house_id: `1000000${i}`,
        vacant_house_address: `愛知県豊田市${area_group}${i}丁目`,
        gml_id: `1000000${i}`,
        measuredheight: Math.floor(Math.random() * 100),
        rank: Math.floor(Math.random() * 100),
        depth: Math.floor(Math.random() * 100),
        duration: Math.floor(Math.random() * 100),
        floors_above_ground: Math.floor(Math.random() * 100),
        floors_below_ground: Math.floor(Math.random() * 100),
        inland_flooding_risk_desc: `内水氾濫リスク${i}`,
        inland_flooding_risk_rank: Math.floor(Math.random() * 100),
        inland_flooding_risk_depth: Math.floor(Math.random() * 100),
        river_flooding_risk_desc: `河川氾濫リスク${i}`,
        river_flooding_risk_rank: Math.floor(Math.random() * 100),
        river_flooding_risk_depth: Math.floor(Math.random() * 100),
        landslide_risk_desc: `地滑りリスク${i}`,
        name: `建物名${i}`,
        predicted_label: Math.round(pred),
        predicted_probability: pred,
        geometry: geoJSONToWkt({
          type: "Polygon",
          coordinates: [
            [
              [137.120435, 34.990565],
              [137.12052, 34.990551],
              [137.120504, 34.990487],
              [137.120419, 34.990501],
              [137.120435, 34.990565],
            ],
          ],
        }),
      };

      await tx.insert(data_set_detail_buildings).values(insertion);
    }
  });
}) satisfies IpcMainListener;

const dummyAreaGeometry: Polygon["coordinates"] = [
  [
    [137.1417634180236, 35.10681459304291],
    [137.1425037973685, 35.10691618953137],
    [137.142558491844, 35.10742326798803],
    [137.1426395918276, 35.10812134726976],
    [137.1432998242431, 35.10816439418316],
    [137.143306805987, 35.10813890174741],
    [137.1433274623261, 35.10806348185476],
    [137.1433938679742, 35.10794954721418],
    [137.1434593377668, 35.10785991192847],
    [137.1435289139342, 35.10779647538067],
    [137.1436257220657, 35.10773797334976],
    [137.1437338311608, 35.10770327942146],
    [137.1438115298394, 35.10769209992062],
    [137.1440425826669, 35.10769539437319],
    [137.1440907806943, 35.10774385839228],
    [137.1441684430864, 35.10782310465571],
    [137.1442487745875, 35.10788699978492],
    [137.144316101611, 35.10792497248092],
    [137.1447520908619, 35.10825762328256],
    [137.1455827004369, 35.10761876412475],
    [137.1437524687389, 35.10599496909195],
    [137.1436266313275, 35.10584084641687],
    [137.1435945147261, 35.10576604674763],
    [137.1433971050809, 35.10557669568782],
    [137.1433008911342, 35.10548413339183],
    [137.1433623342542, 35.10542858215249],
    [137.1434340186195, 35.10537472408392],
    [137.1435015988492, 35.10533269652102],
    [137.1435917099911, 35.1052973630385],
    [137.1436859013463, 35.1052906964638],
    [137.1439766723401, 35.10530421424272],
    [137.1443186346419, 35.10527401096763],
    [137.1443902965694, 35.10526895679816],
    [137.1444455942294, 35.10526389883663],
    [137.1444906451743, 35.10525721871477],
    [137.1445265087396, 35.10515201039352],
    [137.1445531401166, 35.10507292898382],
    [137.1447796252404, 35.10427956417942],
    [137.1448892436987, 35.1040061260385],
    [137.1445648680917, 35.10340447596695],
    [137.1445485115399, 35.10333714579857],
    [137.1445608155319, 35.10326813087321],
    [137.1446468683016, 35.10305778596425],
    [137.1446335807157, 35.10300144163244],
    [137.1445987827393, 35.10293241614502],
    [137.1444053534164, 35.10270440138666],
    [137.1442723153677, 35.10252767089381],
    [137.1440932524474, 35.10219190464415],
    [137.1440318785377, 35.10203033337334],
    [137.1439715137718, 35.10189143638119],
    [137.1439490198133, 35.10176860712062],
    [137.1439368014942, 35.10154302836987],
    [137.1439358131439, 35.10144126112643],
    [137.1439747509951, 35.10132182665014],
    [137.1440689654773, 35.1012259280304],
    [137.1437925287851, 35.10144510054852],
    [137.1436296630522, 35.10166204719777],
    [137.143462982442, 35.10189744334706],
    [137.1432794061334, 35.10217593735381],
    [137.1427207268479, 35.10328290766201],
    [137.1424701172552, 35.1032756644579],
    [137.1416521654193, 35.10335799771313],
    [137.1411426745352, 35.10341766039627],
    [137.1407198182872, 35.10349727240634],
    [137.1403246943181, 35.10356829778186],
    [137.1400672536932, 35.10365140468206],
    [137.1398705598096, 35.10399841059964],
    [137.1398128069069, 35.10410220167952],
    [137.1397704252429, 35.10416346187188],
    [137.1397265725575, 35.10421507166978],
    [137.1396856533598, 35.1042450609692],
    [137.1396067534046, 35.1042666610071],
    [137.1393554397563, 35.10430624331118],
    [137.1391216368267, 35.10441421115571],
    [137.1390208042388, 35.10446946836191],
    [137.1389352923966, 35.10459726719193],
    [137.1386450935628, 35.10512735265074],
    [137.138435335951, 35.10541364738009],
    [137.1379381926394, 35.10614875340299],
    [137.1374032181815, 35.10680215272879],
    [137.1374854495432, 35.10690358947284],
    [137.1379377275359, 35.10745585638003],
    [137.1377800428058, 35.10807872748471],
    [137.137731759291, 35.10827837149668],
    [137.139677435327, 35.10886646873273],
    [137.1393965801056, 35.10953381872098],
    [137.1396374460234, 35.10960747774993],
    [137.1396646614093, 35.10956347003804],
    [137.1398704206368, 35.1093156262557],
    [137.140035060233, 35.10901143068884],
    [137.1401036765257, 35.10884242703425],
    [137.1401311296025, 35.10875228932654],
    [137.1401038254577, 35.10839170230918],
    [137.1403096212326, 35.10801990854144],
    [137.1403919014513, 35.10798612575125],
    [137.1407211362764, 35.10751295051832],
    [137.1407074522647, 35.10741153389846],
    [137.1407349115204, 35.10729885982565],
    [137.1408034939907, 35.10722000074777],
    [137.1408857802084, 35.10717494952673],
    [137.1409954932277, 35.10709610094991],
    [137.1413657978077, 35.10679195641099],
    [137.1417634180236, 35.10681459304291],
  ],
];
