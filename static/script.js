let map, stationsData;

function initMap() {
     map = L.map("map", {
          zoomControl: false
     }).setView([55.7558, 37.6176], 8);

     fetch('/get_jawg_access_token')
     .then(response => response.text())
     .then(accessToken => {
         const tileMap = L.tileLayer(`https://tile.jawg.io/c47fbdfb-1da7-48c2-afb4-d14e616a6004/{z}/{x}/{y}{r}.png?access-token=${accessToken}`, {
             attribution: "<a href=\"https://www.jawg.io?utm_medium=map&utm_source=attribution\" target=\"_blank\">&copy; Jawg</a> - <a href=\"https://www.openstreetmap.org?utm_medium=map-attribution&utm_source=jawg\" target=\"_blank\">&copy; OpenStreetMap</a>&nbsp;contributors",
             minZoom: 5,
             maxZoom: 23,
         });
         tileMap.addTo(map);
     })

     L.control.scale({
          metric: true,
          imperial: false,
     }).addTo(map)

     let geoJSONLayer = null;
     let trainGeometryLayer = null;
     let stationCluster = null;

     if (!geoJSONLayer) {
          fetch('/get_stations')
               .then(response => response.json())
               .then(data => {
                    stationCluster = L.markerClusterGroup({showCoverageOnHover: false});
                    geoJSONLayer = L.geoJSON(data, {
                         pointToLayer: function (feature, latlng) {
                         const stationCode = feature.properties.code;
                         const stationName = feature.properties.name;
                         
                         const customIcon = L.icon({
                              iconUrl: '/get_icon/stations',
                              iconSize: [30,30],
                         });
                         const marker = L.marker(latlng, { icon: customIcon });
                         marker.bindPopup(stationName).on('click', function (e) {
                              const popupContent = `
                                   <div style="max-height: 200px; overflow-y: auto;">
                                        <p><b>${stationName}</b></p>
                                        <p>Загрузка информации о поездах...</p>
                                   </div>
                              `;
                              document.getElementById('train-info-content').innerHTML = popupContent;

                              fetch(`/get_train_by_station/${stationCode}`)
                                   .then(response => response.json())
                                   .then(trains => {
                                        const trainButtons = trains.map(train => `<button class="train-button" data-train="${train}">${train}</button>`).join('');
                                        const updatedPopupContent = `
                                             <div style="max-height: 600px; overflow-y: auto;">
                                             <p><b>${stationName}</b></p>
                                             <div class="button-container">
                                                  ${trainButtons}
                                             </div>
                                             </div>
                                        `;
                                        document.getElementById('train-info-content').innerHTML = updatedPopupContent;

                                        const buttons = document.querySelectorAll('.train-button');
                                        buttons.forEach(button => {
                                             button.addEventListener('click', function () {
                                             const trainNumber = this.getAttribute('data-train');
                                             fetch(`/get_train_info/${trainNumber}`)
                                                  .then(response => response.json())
                                                  .then(trainInfo => {
                                                       const trainPopupContent = `
                                                            <p>Номер: ${trainInfo.num}</p>
                                                            <p>Маршрут: ${trainInfo.route}</p>
                                                            <p>Тип: ${trainInfo.category}</p>
                                                       `;

                                                       document.getElementById('train-info-content').innerHTML = trainPopupContent;

                                                       const trainGeometry = trainInfo.geometry;
                                                       const bounds = L.geoJSON(trainGeometry).getBounds();
                                                       map.fitBounds(bounds);

                                                       if (trainGeometryLayer) {
                                                            map.removeLayer(trainGeometryLayer);
                                                       }
                                                       trainGeometryLayer = L.geoJSON(trainGeometry, {
                                                            pointToLayer: function (feature, latlng) {
                                                                 var marker = L.marker(latlng, { icon: customIcon });
                                                                 if (feature.properties && feature.properties.name) {
                                                                 marker.bindTooltip(feature.properties.name, { permanent: true, direction: 'top' });
                                                                 }
                                                                 return marker;
                                                            }
                                                       }).addTo(map);
                                                       map.removeLayer(stationCluster);

                                                  })
                                                  .catch(error => console.error('Error:', error));
                                             });
                                        });
                                   })
                                   .catch(error => console.error('Error:', error));
                         });
                         return marker;
                         }
                    });
                    map.addLayer(stationCluster);
                    stationCluster.addLayer(geoJSONLayer);
               });
     } else {
          fetch('/get_stations')
               .then(response => response.json())
               .then(data => {
                    geoJSONLayer.clearLayers(); 
                    geoJSONLayer.addData(data); 
               });
     }

     map.on('click', function (e) {
     if (trainGeometryLayer) {
          map.removeLayer(trainGeometryLayer);
          trainGeometryLayer = null;
          map.addLayer(stationCluster)
     }
     });

     map.on('click', function (event) {
          const trainInfo = document.getElementById('train-info-content');
          const isClickInsideTrainInfo = trainInfo.contains(event.originalEvent.target);
          if (!isClickInsideTrainInfo) {
               trainInfo.innerHTML = 'Выберите станцию для просмотра информации о поездах';
          }
     });

     let vectorTiles;

     function createTileLayer(zoom) {
          let zoom_levels;
          
          if (zoom > 15) {
               zoom_levels = 'more_15';
          } else if (zoom <= 15 && zoom > 10) {
               zoom_levels = '10_15';
          } else if (zoom <= 10 && zoom > 7) {
               zoom_levels = '7_10';
          } else if (zoom <= 7) {
               zoom_levels = 'less_7';
          }
          
          fetch(`/get_tile_url/${zoom_levels}`)
               .then(response => response.text())
               .then(tileURL => {
                    if (vectorTiles) {
                         map.removeLayer(vectorTiles);
                    }
                    vectorTiles = L.tileLayer(tileURL, {}).addTo(map);
               })
               .catch(error => {
                    console.error('Ошибка при загрузке тайлов:', error);
               });
     }
     
     createTileLayer(map.getZoom());
     
     map.on('zoomend', function() {
     const zoom = map.getZoom();
     createTileLayer(zoom);
     });
     
}

function searchStations() {
     $('#search').on('input', function() {
          const query = $(this).val();
          if (query.length > 2) {
               $.get('/search_stations', { q: query }, function(data) {
               const results = data.stations;
               const resultsList = $('#search_results').empty().show();
               results.forEach(station => {
                    const listItem = $('<li>').text(station.name).data('coords', station.coords);
                    resultsList.append(listItem);
               });
               });
          } else {
               $('#search_results').empty().hide();
          }
     });

     $('#search_results').on('click', 'li', function() {
          const coords = $(this).data('coords');
          map.setView(coords, 15);
          $('#search_results').empty();
          $('#search').val('');
     });
          
     $(document).click(function(e) {
          if (!$(e.target).closest('#menu').length) {
               $('#search_results').empty().hide();
          }
     });     
}

function api () {
     $('.get_data_btn').click(function(){
     var endpoint = $(this).data('endpoint');
     $.get(endpoint, function(response){
          $('#data_display').text(response.message);
     });
     });
}

$(document).ready(function () {
     initMap();
     searchStations();
     api();
})



