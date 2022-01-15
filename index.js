'use strict';

const express = require('express');
const axios = require('axios');
const url = require('url');
const redis = require('redis');

const app = express();
const redisClient = redis.createClient({
    host: 'redis-server',
    port: 6379
});

redisClient.on('ready',function() {
 console.log("Redis is ready");
});

redisClient.on('error',function(err) {
 console.log("Error in Redis");
 console.log(err)
});

function processRequestApiOutput(req, res) {
  processRequest(req, res, false);
}

function processRequestPrettyOutput(req, res) {
  processRequest(req, res, true);
}

function processRequest(req, res, pretty) {
  const cityName = req.params.cityName;
  let weather = {};
  let dataSource = "";
  try {
    //Lookup cityName in redis cache
    redisClient.get(cityName, async (err, reply) => {
      if (err) {
        throw err;
      }
      
      //If cityName is found in redis, return it to the client
      if (reply) {
        weather = JSON.parse(reply),
        dataSource = "Redis cache"
     
      //If cityName is not found in redis, fetch it from the openweather api  
      } else {
        const params = new url.URLSearchParams({ 
          q: cityName, 
          appid: 'd9ed7c98aacfc24ea69ff630f03a5f00',
          units: 'metric',
          lang:  'de'
        });
        const result = await axios.get(`https://api.openweathermap.org/data/2.5/weather?${params}`);
        
        //Store weather for cityName in redis cache
        redisClient.setex(cityName, 600, JSON.stringify(result.data), function(err,reply) {
          if (err) {
            throw err;
          }
          
          if (reply) {
            console.log(reply);
          }
        });

        weather = result.data,
        dataSource = "Openweather API"
      }
      
      if (pretty) {
        res.render('index', { 
          dataSource: dataSource,
          title: "MCCE - SOAPT - Team J", 
          json: weather, 
          jsonPretty: JSON.stringify(weather, null, 4)
        });
      } else {
        res.status(200).send(weather);
      }

    });
  } catch(err) {
    res.status(500).send({message: err.message});
  }
}

app.set('view engine', 'pug');
app.set('json spaces', 40);

app.get('/weather/:cityName', processRequestApiOutput);
app.get('/weatherPretty/:cityName', processRequestPrettyOutput);

//specifying the listening port
app.listen(8081, ()=>{
    console.log('Listening on port 8081')
})
