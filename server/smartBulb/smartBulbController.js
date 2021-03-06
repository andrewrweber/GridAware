var request = require('request');
var moment = require('moment');
var WattEnergy = require('./../wattTime/energyModel').WattTotal;
var wattTimeToken = require('./../config/tokenConfig.js').wattTimeAPIToken;

// This value gets updated every hour with the findMaxCarbonThisWeek function below
// That function runs once every hour
var weeklyMaxCarbon = 1353;
var weeklyMinCarbon = 1056;
// This value gets updated every hour
var colorValue = 0.38;

var getColor = function(req, res){
  res.json(colorValue);
};

var findMaxCarbonThisWeek = function(data) {
  getOneWeek(function(data){
    setMaxMin(data);
  });
};

var setMaxMin = function(data){
  if(data.length > 1){
    var max = data[0].carbon;
    var min = data[0].carbon;
    for(var i = 1; i < data.length; i++){
      if(data[i].carbon > max){
        max = data[i].carbon;
      }
      if(data[i].carbon < min){
        min = data[i].carbon;
      }
    }
    console.log('Weekly max carbon now: ', max.toFixed(2));
    console.log('Weekly min carbon now: ', min.toFixed(2));
    weeklyMaxCarbon = parseFloat(max.toFixed(2));
    weeklyMinCarbon = parseFloat(min.toFixed(2));
  }
};

var getOneWeek = function(cb){ 
  var oneWeekAgo = new Date(new Date().setDate(new Date().getDate()-7)).toISOString().slice(0,-5);
  WattEnergy.find({ 
    timestamp: {$lt: new Date(), $gt: oneWeekAgo}
  }).exec(function(err, data){ 
    if(err){ 
      res.status(500).send("Error in querying Watt database.");
    } else { 
      cb(data);
    }
  });
};

function getNearestHour() {
  var date = new Date(Date.now()); 

  date.setHours(date.getHours() + Math.round(date.getMinutes()/60));
  date.setMinutes(0);
  date.setSeconds(0);

  //console.log(date.toISOString());
  var formattedDate = (moment(date).utc().format("YYYY-MM-DDTHH:mm:ss") + 'Z');
  return formattedDate;
}

var getCarbonReading = function(wattimeArray, datestring, cb){
  for(var i = 0; i < wattimeArray.length; i++){
    if(wattimeArray[i].timestamp === datestring){
      cb(wattimeArray[i].carbon);
      break;
    }
  }
}

var makeWattTimeRequest = function(){
  var base_url = 'https://api.watttime.org/api/v1/datapoints/?ba=CAISO&market=DAHR'
  var formattedDate = getNearestHour();
  var url = base_url + '&start_at=' + formattedDate.replace(/:/g, '%3A');

  var options = { 
     url: url,
     headers: { 
       'Authorization' : wattTimeToken
     }
   };

  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      getCarbonReading(JSON.parse(body).results, formattedDate, 
        function(carbon){
          setColorCode(carbon);
        });
    }
    else {
      console.log(JSON.parse(body));
      console.log("Error getting data from WattTime");
    }
  })
};

var setColorCode = function(carbon){
  var carbonRange = weeklyMaxCarbon - weeklyMinCarbon;
  var percentMax = (carbon - weeklyMinCarbon)/carbonRange;
  if(percentMax > 1){percentMax = 1};
  if(percentMax < 0){percentMax = 0};

  colorValue = parseFloat(percentMax.toFixed(2));
  console.log('colorValue now is ',colorValue)
};

// Check for new bulb color every hour
setInterval(makeWattTimeRequest, 3600000);

// Check for new max carbon value every 3 hours
setInterval(findMaxCarbonThisWeek, 10800000)

// findMaxCarbonThisWeek()
setTimeout(makeWattTimeRequest, 15000);
//Update max carbon on server restart.
setTimeout(findMaxCarbonThisWeek, 15000);

module.exports = {
  getColor: getColor
}