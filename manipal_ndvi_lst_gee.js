// ---------------------------------------------------------------------
// 1. STUDY AREA & SETUP
// ---------------------------------------------------------------------
var roi = ee.FeatureCollection('projects/master-reactor-471013-c9/assets/Manipal_3km');

var seasons = {
  'Pre-Monsoon': [3, 5],
  'Monsoon': [6, 9],
  'Post-Monsoon': [10, 11],
  'Winter': [12, 2]
};

function maskClouds(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 1).eq(0)
    .and(qa.bitwiseAnd(1 << 2).eq(0))
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 4).eq(0));
  return image.updateMask(mask);
}

var collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .merge(ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"))
  .filterBounds(roi)
  .filterDate('2020-01-01', '2025-12-31')
  .map(maskClouds);

// ---------------------------------------------------------------------
// 2. SEASONAL PROCESSING
// ---------------------------------------------------------------------
Object.keys(seasons).forEach(function(seasonName) {

  var months = seasons[seasonName];

  var seasonalCol = collection.filter(
    (seasonName === 'Winter') ? 
      ee.Filter.or(
        ee.Filter.calendarRange(12, 12, 'month'),
        ee.Filter.calendarRange(1, 2, 'month')
      )
      :
      ee.Filter.calendarRange(months[0], months[1], 'month')
  );

  var composite = seasonalCol.median();

  // --- LST ---
  var lst = composite.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .clip(roi);

  // --- NDVI ---
  var ndvi = composite.normalizedDifference(['SR_B5', 'SR_B4'])
    .rename('NDVI')
    .clip(roi);

  // Visualization params
  var lstVis = {
    'Pre-Monsoon': {min: 28, max: 53},
    'Monsoon':     {min: 23, max: 45},
    'Post-Monsoon':{min: 25, max: 44},
    'Winter':      {min: 25, max: 47}
  };

  Map.addLayer(lst, {
    min: lstVis[seasonName].min, 
    max: lstVis[seasonName].max, 
    palette: ['blue', 'green', 'yellow', 'red']
  }, seasonName + ' LST', false);

  Map.addLayer(ndvi, {
    min: -1, 
    max: 0.6, 
    palette: ['blue', 'white', 'green']
  }, seasonName + ' NDVI', false);

  // Debug Stats
  var stats = ndvi.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e13
  });
  print(seasonName + ' NDVI Stats:', stats);

  // -----------------------------------------------------------------
  // EXPORT TO GOOGLE DRIVE
  // -----------------------------------------------------------------

  Export.image.toDrive({
    image: lst,
    description: seasonName + '_LST_2020_2025',
    folder: 'Manipal_Seasonal_Maps',
    fileNamePrefix: seasonName + '_LST',
    region: roi.geometry(),
    scale: 30,
    maxPixels: 1e13
  });

  Export.image.toDrive({
    image: ndvi,
    description: seasonName + '_NDVI_2020_2025',
    folder: 'Manipal_Seasonal_Maps',
    fileNamePrefix: seasonName + '_NDVI',
    region: roi.geometry(),
    scale: 30,
    maxPixels: 1e13
  });

});

Map.centerObject(roi, 13);
