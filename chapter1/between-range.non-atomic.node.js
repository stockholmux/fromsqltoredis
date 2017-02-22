var
  argv        = require('yargs')                            // `yargs' is a command line parser
    .demand('credentials')                                  // complain if the '--credentials' argument isn't supplied
    .demand('start')
    .demand('end')
    .argv,                                                  // return it back as an object
  redis       = require('redis'),                           // node_redis module
  rk          = require('rk'),                              // Concats strings together with a ":"
  Table       = require('cli-table'),                       // pretty tables for the CLI
  credentails = require(argv.credentials),                  // Our credentials are stored in a node_redis connection object - see https://github.com/NodeRedis/node_redis#rediscreateclient
  client      = redis.createClient(credentails),            // Client object for connection to the Redis server
  keyRoot     = 'redishop';                                 // All keys start with this


function betweenRange() {
  if (argv.perf) {
    console.time('totalExecutionTime');                     // Start a timer to see how long our operation takes.
    console.time('justRedisTime');                          // This timer only shows the time it takes for Redis to return - not the JS to process the data.
  }

  client.zrangebyscore(                                     // Get the before a range by score on a zset
    'redishop:priceIndex',                                  // The key
    argv.start,                                             // Start from the arguments
    argv.end,                                               // End from the arguments
    function(err, slugs) {                                  // `slugs` will contain an array of slugs
      var
        getItemsMulti = client.multi();                     // stow our multi instance in the getItemsMulti var

      if (err) { throw err; }                               // handle errors

      slugs.forEach(function(aSlug) {                       // on each slug in the array
        getItemsMulti.hmget(                                // do a multiple field get on a hash
          rk(keyRoot,'items',aSlug),                        // with the key like redishop:items:[slug]
          'price',                                          // get the price
          'name'                                            // and the name
        );                                                  // We don't need to get the slug here, since we got it from the zset
      });
      getItemsMulti.exec(function(err,itemData) {           // Run the queued up commands in the MULTI/EXEC block
        var
          itemsTable;

        if (argv.perf) {                                    
          console.timeEnd('justRedisTime');                 // This will measure just the time it takes to get a minimal Redis response with no further processing
        }

        if (err) { throw err; }

        itemsTable = new Table({                            // create a pretty table
          head: ['Slug', 'Price', 'Name']                   // with three columns
        });
                                                            // combine the slugs with the rest of the data
        slugs.forEach(function(aSlug,index) {  
          itemsTable.push([aSlug].concat(itemData[index])); // match the slugs with the price and name by index
        });
        

        if (argv.perf) {
          console.timeEnd('totalExecutionTime');            // End the timer, display before the pretty table (timing the operation, not the output)
        }

        console.log(itemsTable.toString());                 // render out the pretty table
        console.log(itemsTable.length);                     // number of rows
        client.quit();                                      // Properly quit the client connection
      });
    }
  );
}

if (argv.perf) {                                            // If we supply the --perf switch it'll measure the speed
  client.on('ready',function() {                            // Normally you don't need this as node_redis will queue up commands as you are establishing a connection, but to get a clean perf, you need to wait until ready
    betweenRange();
  });
}

if (!argv.perf) {                                           // If not running perf
  betweenRange();                                           // Then just run the betweenRange function, it'll queue up
}