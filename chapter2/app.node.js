var
  argv        = require('yargs')                            // `yargs' is a command line parser
    .demand('credentials')                                  // complain if the '--credentials' argument isn't supplied
    .argv,                                                  // return it back as an object
  bodyParser  = require('body-parser'),                     // enable parsing of HTTP bodies
  express     = require('express'),                         // Web server module
  redis       = require('redis'),                           // node_redis module
  rk          = require('rk'),                              // Concats strings together with a ":"
  
  credentails = require(argv.credentials),                  // Our credentials are stored in a node_redis connection object - see https://github.com/NodeRedis/node_redis#rediscreateclient
  app         = express(),                                  // Create the web server instance
  keyRoot     = 'redishop',                                 // All keys start with this
  resultSize  = 100,                                        // default "page" size
  client;

client = redis.createClient(credentails);                   // Client object for connection to the Redis server

app.get(                                                    // A HTTP GET route
  '/api/items-by-price/:start(\\d+)',                       // match only '/api/items-by-price/[a number]
  function(req,res,next) {
    var
      start = Number(req.params.start),                     // get the start (offset) number from the URL
      end   = start+resultSize-1;                           // determine the end

    client.zrange(                                          // ZRANGE Redis command
      rk(keyRoot,'priceIndex'),                             // at redishop:priceIndex
      start,                                                // from
      end,                                                  // to
      function(err,slugs) {
        if (err) { next(err); } else {                      // handle the errors
          res.send({                                        // send JSON back 
            start : start,                                  // Starting point
            end   : end,                                    // Ending point
            items : slugs                                   // Array of slugs
          });
        }
      }
    );
  }
);

app.post(                                                   // A HTTP GET route
  '/api/:kindOfData(items|companies)',                      // Either /api/items or /api/companies
  bodyParser.json(),                                        // parse out the body
  function(req,res,next) {
    var
      getHashMulti  = client.multi();                       // start a MULIT/EXEC block
    
    req.body.forEach(function(aSlug) {                      // each item in the body
      getHashMulti.hgetall(                                 // get all the field/values (HGETALL)
        rk(keyRoot,req.params.kindOfData,aSlug)             // at "redishop:items:[slug]" or "redishop:companies:[slug]"
      );
    });

    getHashMulti.exec(function(err,data) {                  // end the MULTI/EXEC block
      if (err) { next(err); } else {                        // handle the errors
        res.send(data);                                     // send the data back over HTTP
      }
    });
  }
);

app
  .use(express.static('static'))                            // Server out our static HTML
  .use(
    '/images',                                              // Any url that starts with /images
    express.static(
      '../node_modules/ecommerce-sample-set/images'         // serve out our example images
    )
  )
  .listen(5599, function () {                               // Start the server
    console.log('ready');                                   // log that we're ready
  }
);