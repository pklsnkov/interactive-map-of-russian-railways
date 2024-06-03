from flask import Flask, render_template, jsonify, request, send_file, send_from_directory

from db_operations import get_trains_by_esr_code, get_train_info_by_train_num, get_stations_in_geojson

from config import jawg_access_token, tile_url_ids

app = Flask(__name__)

def get_stations_list():
    stations = get_stations_in_geojson()
    stations_list = []
    for station in stations['features']:
        stations_list.append({
            "name": station['properties']['name'],
            "coords": [station['geometry']['coordinates'][1], station['geometry']['coordinates'][0]],
            "code": station['properties']['name'],
        })
    return stations_list

def wkt2geojson(wkt_strings):
    features = []
    for name, wkt_str in wkt_strings:
        coords_list = wkt_str.replace('POINT (', '').replace(')', '').split(' ')
        geometry = {'type': 'Point', 'coordinates': (coords_list[0], coords_list[1])}
        feature = {
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "name": name
            }
        }
        features.append(feature)
    return {
        "type": "FeatureCollection",
        "features": features
    }

@app.route('/')
def index(): 
    return render_template('index.html')

# @app.route('/send_frontend_message/<message>')
# def send_frontend_message(message):
#     print(message)

@app.route('/get_stations')
def get_stations_data():
    stations = get_stations_in_geojson()
    return stations

stations_list = None
@app.route('/search_stations', methods=['GET'])
def search_stations():
    global stations_list
    
    if stations_list is None:
        stations_list = get_stations_list()
        
    query = request.args.get('q', '').lower()
    results = [station for station in stations_list if query in station['name'].lower()]
        
    return jsonify(stations=results)

@app.route('/get_train_by_station/<code>')
def get_train_by_station(code):
    trains = get_trains_by_esr_code(code)
    return jsonify(trains)

@app.route('/get_train_info/<train_num>')
def get_train_info(train_num):
    train_num = train_num.split(',')[0]
    train_info, stations_geom_list = get_train_info_by_train_num(train_num)
    
    train_id, num, category, route, stations = train_info[0], train_info[1], train_info[2], train_info[3], train_info[4]
    route_geom = wkt2geojson(stations_geom_list)
    
    return jsonify({
        'train_id': train_id,
        'num': num,
        'category': category,
        'route': route,
        'stations': stations,
        'geometry': route_geom,
    })

@app.route('/get_icon/<icon_type>')
def get_icon(icon_type):
    if icon_type == 'stations':
        icon = f'static\\stations.svg'
    elif icon_type == 'railway':
        icon = f'static\\railway.svg'
    return send_file(icon, mimetype='image/svg+xml')

@app.route('/get_jawg_access_token')
def get_jawg_access_token():
    return jawg_access_token

@app.route('/get_tile_url/<zoom_levels>')
def get_tile_url(zoom_levels):
    return tile_url_ids[zoom_levels]


if __name__ == '__main__':
    app.run(debug=True)
