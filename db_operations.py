'''
Set of scripts for database query processing
'''

import psycopg2
from config import USER, PASSWORD, HOST, PORT, DATABASE

def get_stations_in_geojson():
     '''
     Getting ststions data from database
     '''
     conn = psycopg2.connect(
          user=USER,
          password=PASSWORD,
          host=HOST,
          port=PORT,
          database=DATABASE
     )
     cur = conn.cursor()
     
     stations_query = "SELECT * FROM stations"
     cur.execute(stations_query)
     stations = cur.fetchall()
     
     geojson_data = {
          "type": "FeatureCollection",
          "name": "stations",
          "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
          "features": []
     }
     
     for station in stations:
          code = station[1]
          name = station[2]
          geom_wkt = station[3]
          
          feature = {
               "type": "Feature",
               "properties": {
                    "name": name,
                    "code": code
               },
               "geometry": {
                    "type": "Point",
                    "coordinates": [float(coord) for coord in geom_wkt.replace("POINT (", "").replace(")", "").split(' ')]
               }
          }
          geojson_data["features"].append(feature)
          
     return geojson_data
     

def get_trains_by_esr_code(esr_code):
     '''
     Getting the list of trains by ESR code
     '''
     conn = psycopg2.connect(
          user=USER,
          password=PASSWORD,
          host=HOST,
          port=PORT,
          database=DATABASE
     )
     cur = conn.cursor()
     
     station_by_esr_code_query = f"SELECT * FROM stations WHERE code='{esr_code}'"
     cur.execute(station_by_esr_code_query)
     
     station_id = cur.fetchall()[0][0]
     
     train_by_station_id_query = f"SELECT train_id FROM route_points WHERE station_id={station_id}"
     cur.execute(train_by_station_id_query)
     trains_ids = cur.fetchall()
     
     train_ids_str = ','.join(str(train_id[0]) for train_id in trains_ids)
     train_info_query = f"SELECT number, route FROM trains WHERE id IN ({train_ids_str})"
     cur.execute(train_info_query)
     trains_list = cur.fetchall()
     
     cur.close()
     conn.close()
     
     return trains_list

def get_train_info_by_train_num(train_num):
     '''
     Getting train information by train number
     '''
     conn = psycopg2.connect(
          user=USER,
          password=PASSWORD,
          host=HOST,
          port=PORT,
          database=DATABASE
     )
     cur = conn.cursor()
     
     train_info_query = f"SELECT * FROM trains WHERE number='{train_num}'"
     cur.execute(train_info_query)
     train_info = cur.fetchall()[0]
     train_info = list(train_info)
     
     train_id = train_info[0]
     stations_on_train_route = f"SELECT station_id FROM route_points WHERE train_id={train_id}"
     cur.execute(stations_on_train_route)
     stations_ids = cur.fetchall()
     stations_ids_str = ','.join(str(stations_id[0]) for stations_id in stations_ids)
     stations_info_query = f"SELECT name, geometry FROM stations WHERE id IN ({stations_ids_str})"
     cur.execute(stations_info_query)
     stations_info = cur.fetchall()
     
     stations_geom_list = []
     stations_name_list = []
     for station_info in stations_info:
          stations_geom_list.append(station_info[1])
          stations_name_list.append(station_info[0])
     
     train_info.append(stations_name_list)
     
     cur.close()
     conn.close()
     return (train_info, stations_info)
     
# result_trains_list = get_trains_by_esr_code('289503')
# print(result_trains_list)
# train_id, num, category, route = get_train_info_by_train_num('309С')
# print('')

# get_stations_in_geojson()