//! Convert geometries to GeoPackage SQL Geometry Binary Format
//!
//! cf. https://www.geopackage.org/spec130/#gpb_format

use std::io::Write;

use flatgeom::{Coord, MultiPolygon, Polygon};

#[repr(u8)]
pub enum WkbByteOrder {
    // Big endian (XDR)
    BigEndian = 0,
    // Little endian (NDR)
    LittleEndian = 1,
}

#[repr(u32)]
pub enum WkbGeometryType {
    Point = 1,
    LineString = 2,
    Polygon = 3,
    MultiPoint = 4,
    MultiLineString = 5,
    MultiPolygon = 6,
    GeometryCollection = 7,
    PointZ = 1001,
    LineStringZ = 1002,
    PolygonZ = 1003,
    MultiPointZ = 1004,
    MultiLineStringZ = 1005,
    MultiPolygonZ = 1006,
    GeometryCollectionZ = 1007,
    PointM = 2001,
    LineStringM = 2002,
    PolygonM = 2003,
    MultiPointM = 2004,
    MultiLineStringM = 2005,
    MultiPolygonM = 2006,
    GeometryCollectionM = 2007,
    PointZM = 3001,
    LineStringZM = 3002,
    PolygonZM = 3003,
    MultiPointZM = 3004,
    MultiLineStringZM = 3005,
    MultiPolygonZM = 3006,
    GeometryCollectionZM = 3007,
}

// Parse WKB to WKT
pub fn wkb_to_wkt(data: &[u8]) -> String {
    if data.len() < 8 {
        return String::new();
    }

    let wkb = &data[8..];
    if wkb.is_empty() {
        return String::new();
    }

    // Get byte order
    let byte_order = wkb[0];
    let is_little_endian = byte_order == WkbByteOrder::LittleEndian as u8;

    // Get geometry type
    let type_bytes = &wkb[1..5];
    let geometry_type = if is_little_endian {
        u32::from_le_bytes([type_bytes[0], type_bytes[1], type_bytes[2], type_bytes[3]])
    } else {
        u32::from_be_bytes([type_bytes[0], type_bytes[1], type_bytes[2], type_bytes[3]])
    };
    // Parse coordinates based on geometry type
    match geometry_type {
        1 => parse_point(&wkb[5..], is_little_endian),
        1001 => parse_point_z(&wkb[5..], is_little_endian),
        6 => parse_multipolygon(&wkb[5..], is_little_endian),
        1006 => parse_multipolygon_z(&wkb[5..], is_little_endian),
        _ => format!("GEOMETRY_TYPE_{}", geometry_type),
    }
}

fn read_f64(data: &[u8], offset: &mut usize, is_little_endian: bool) -> f64 {
    let bytes = &data[*offset..*offset + 8];
    let value = if is_little_endian {
        f64::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]])
    } else {
        f64::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]])
    };
    *offset += 8;
    value
}

fn parse_point(data: &[u8], is_little_endian: bool) -> String {
    let mut offset = 0;
    let x = read_f64(data, &mut offset, is_little_endian);
    let y = read_f64(data, &mut offset, is_little_endian);
    format!("POINT({} {})", x, y)
}

fn parse_point_z(data: &[u8], is_little_endian: bool) -> String {
    let mut offset = 0;
    let x = read_f64(data, &mut offset, is_little_endian);
    let y = read_f64(data, &mut offset, is_little_endian);
    let z = read_f64(data, &mut offset, is_little_endian);
    format!("POINT Z({} {} {})", x, y, z)
}

fn parse_multipolygon(data: &[u8], is_little_endian: bool) -> String {
    let mut offset = 0;
    let num_polygons = if is_little_endian {
        u32::from_le_bytes([data[0], data[1], data[2], data[3]])
    } else {
        u32::from_be_bytes([data[0], data[1], data[2], data[3]])
    };
    offset += 4;

    let mut polygons = Vec::new();
    for _ in 0..num_polygons {
        offset += 5; // Skip byte order and geometry type
        let num_rings = if is_little_endian {
            u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
        } else {
            u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
        };
        offset += 4;

        let mut rings = Vec::new();
        for _ in 0..num_rings {
            let num_points = if is_little_endian {
                u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
            } else {
                u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
            };
            offset += 4;

            let mut points = Vec::new();
            for _ in 0..num_points {
                let x = read_f64(data, &mut offset, is_little_endian);
                let y = read_f64(data, &mut offset, is_little_endian);
                points.push(format!("{} {}", x, y));
            }
            rings.push(format!("({})", points.join(", ")));
        }
        polygons.push(format!("({})", rings.join(", ")));
    }
    format!("MULTIPOLYGON({})", polygons.join(", "))
}

fn parse_multipolygon_z(data: &[u8], is_little_endian: bool) -> String {
    let mut offset = 0;
    let num_polygons = if is_little_endian {
        u32::from_le_bytes([data[0], data[1], data[2], data[3]])
    } else {
        u32::from_be_bytes([data[0], data[1], data[2], data[3]])
    };
    offset += 4;

    let mut polygons = Vec::new();
    for _ in 0..num_polygons {
        offset += 5; // Skip byte order and geometry type
        let num_rings = if is_little_endian {
            u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
        } else {
            u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
        };
        offset += 4;

        let mut rings = Vec::new();
        for _ in 0..num_rings {
            let num_points = if is_little_endian {
                u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
            } else {
                u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
            };
            offset += 4;

            let mut points = Vec::new();
            for _ in 0..num_points {
                let x = read_f64(data, &mut offset, is_little_endian);
                let y = read_f64(data, &mut offset, is_little_endian);
                let z = read_f64(data, &mut offset, is_little_endian);
                points.push(format!("{} {} {}", x, y, z));
            }
            rings.push(format!("({})", points.join(", ")));
        }
        polygons.push(format!("({})", rings.join(", ")));
    }
    format!("MULTIPOLYGON Z({})", polygons.join(", "))
}

fn write_geometry_header<W: Write>(writer: &mut W, srs_id: i32) -> std::io::Result<()> {
    writer.write_all(&[0x47, 0x50])?; // Magic number
    writer.write_all(&[
        0x00,       // Version
        0b00000001, // Flags
    ])?;
    writer.write_all(&i32::to_le_bytes(srs_id))?; // SRS ID
    Ok(())
}

fn write_polygon_body<W: Write, T: Coord>(
    writer: &mut W,
    poly: &Polygon<T>,
    mapping: impl Fn(T) -> [f64; 3],
) -> std::io::Result<()> {
    // Byte order: Little endian (1)
    writer.write_all(&[WkbByteOrder::LittleEndian as u8])?;

    // Geometry type: wkbPolygonZ (1003)
    writer.write_all(&(WkbGeometryType::PolygonZ as u32).to_le_bytes())?;

    // numRings
    writer.write_all(&(poly.rings().count() as u32).to_le_bytes())?;

    for ring in poly.rings() {
        // numPoints
        writer.write_all(&(ring.iter_closed().count() as u32).to_le_bytes())?;

        for idx in ring.iter_closed() {
            let [x, y, z] = mapping(idx);
            writer.write_all(&f64::to_le_bytes(x))?;
            writer.write_all(&f64::to_le_bytes(y))?;
            writer.write_all(&f64::to_le_bytes(z))?;
        }
    }
    Ok(())
}

pub fn write_indexed_multipolygon<W: Write>(
    writer: &mut W,
    vertices: &[[f64; 3]],
    mpoly: &MultiPolygon<u32>,
    srs_id: i32,
) -> std::io::Result<()> {
    write_geometry_header(writer, srs_id)?;
    write_multipolygon_body(writer, mpoly, |idx| vertices[idx as usize])?;
    Ok(())
}

fn write_multipolygon_body<W: Write, T: Coord>(
    writer: &mut W,
    mpoly: &MultiPolygon<T>,
    mapping: impl Fn(T) -> [f64; 3],
) -> std::io::Result<()> {
    // Byte order: Little endian (1)
    writer.write_all(&[WkbByteOrder::LittleEndian as u8])?;

    // Geometry type: wkbMultiPolygonZ (1006)
    writer.write_all(&(WkbGeometryType::MultiPolygonZ as u32).to_le_bytes())?;

    // numPolygons
    writer.write_all(&(mpoly.len() as u32).to_le_bytes())?;

    for poly in mpoly {
        write_polygon_body(writer, &poly, &mapping)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multipolygon_to_bytes() {
        let vertices: Vec<[f64; 3]> = vec![
            // 1st polygon, exterior (vertex 0~3)
            [0., 0., 111.],
            [5., 0., 111.],
            [5., 5., 111.],
            [0., 5., 111.],
            // 1st polygon, interior 1 (vertex 4~7)
            [1., 1., 111.],
            [2., 1., 111.],
            [2., 2., 111.],
            [1., 2., 111.],
        ];

        let mut mpoly = MultiPolygon::<u32>::new();
        // 1st polygon
        mpoly.add_exterior([0, 1, 2, 3, 0]);
        mpoly.add_interior([4, 5, 6, 7, 4]);

        let mut bytes = Vec::new();
        write_indexed_multipolygon(&mut bytes, &vertices, &mpoly, 1234).unwrap();

        assert_eq!(bytes.len(), 274);

        // header
        assert_eq!(bytes[0..=3].to_vec(), vec![0x47, 0x50, 0x00, 0b00000001]);
        assert_eq!(bytes[4..=7].to_vec(), &i32::to_le_bytes(1234));

        // Byte order: Little endian
        assert_eq!(bytes[8], 0x01);

        // Geometry type: wkbMultiPolygonZ (1006)
        assert_eq!(bytes[9..=12].to_vec(), &1006_u32.to_le_bytes());

        // numPolygons
        assert_eq!(bytes[13..=16].to_vec(), &1_u32.to_le_bytes());

        // 1st polygon
        // Byte order: Little endian
        assert_eq!(bytes[17], 0x01);

        // Geometry type: wkbPolygonZ (1003)
        assert_eq!(bytes[18..=21].to_vec(), &1003_u32.to_le_bytes());

        // numRings
        assert_eq!(bytes[22..=25].to_vec(), &2_u32.to_le_bytes());

        // exterior
        // numPoints
        assert_eq!(bytes[26..=29].to_vec(), &5_u32.to_le_bytes());

        // 1st point
        assert_eq!(bytes[30..=37].to_vec(), &0_f64.to_le_bytes());
        assert_eq!(bytes[38..=45].to_vec(), &0_f64.to_le_bytes());
        assert_eq!(bytes[46..=53].to_vec(), &111_f64.to_le_bytes());

        // 2nd point
        assert_eq!(bytes[54..=61].to_vec(), &5_f64.to_le_bytes());
        assert_eq!(bytes[62..=69].to_vec(), &0_f64.to_le_bytes());
        assert_eq!(bytes[70..=77].to_vec(), &111_f64.to_le_bytes());

        // 3rd point
        assert_eq!(bytes[78..=85].to_vec(), &5_f64.to_le_bytes());
        assert_eq!(bytes[86..=93].to_vec(), &5_f64.to_le_bytes());
        assert_eq!(bytes[94..=101].to_vec(), &111_f64.to_le_bytes());

        // 4th point
        assert_eq!(bytes[102..=109].to_vec(), &0_f64.to_le_bytes());
        assert_eq!(bytes[110..=117].to_vec(), &5_f64.to_le_bytes());
        assert_eq!(bytes[118..=125].to_vec(), &111_f64.to_le_bytes());

        // 5th point
        assert_eq!(bytes[126..=133].to_vec(), &0_f64.to_le_bytes());
        assert_eq!(bytes[134..=141].to_vec(), &0_f64.to_le_bytes());
        assert_eq!(bytes[142..=149].to_vec(), &111_f64.to_le_bytes());

        // interior
        // numPoints
        assert_eq!(bytes[150..=153].to_vec(), &5_u32.to_le_bytes());

        // 1st point
        assert_eq!(bytes[154..=161].to_vec(), &1_f64.to_le_bytes());
        assert_eq!(bytes[162..=169].to_vec(), &1_f64.to_le_bytes());
        assert_eq!(bytes[170..=177].to_vec(), &111_f64.to_le_bytes());

        // 2nd point
        assert_eq!(bytes[178..=185].to_vec(), &2_f64.to_le_bytes());
        assert_eq!(bytes[186..=193].to_vec(), &1_f64.to_le_bytes());
        assert_eq!(bytes[194..=201].to_vec(), &111_f64.to_le_bytes());

        // 3rd point
        assert_eq!(bytes[202..=209].to_vec(), &2_f64.to_le_bytes());
        assert_eq!(bytes[210..=217].to_vec(), &2_f64.to_le_bytes());
        assert_eq!(bytes[218..=225].to_vec(), &111_f64.to_le_bytes());

        // 4th point
        assert_eq!(bytes[226..=233].to_vec(), &1_f64.to_le_bytes());
        assert_eq!(bytes[234..=241].to_vec(), &2_f64.to_le_bytes());
        assert_eq!(bytes[242..=249].to_vec(), &111_f64.to_le_bytes());

        // 5th point
        assert_eq!(bytes[250..=257].to_vec(), &1_f64.to_le_bytes());
        assert_eq!(bytes[258..=265].to_vec(), &1_f64.to_le_bytes());
        assert_eq!(bytes[266..=273].to_vec(), &111_f64.to_le_bytes());
    }
}
