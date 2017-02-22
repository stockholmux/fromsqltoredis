var
  argv        = require('yargs')                            // `yargs' is a command line parser
    .demand('credentials')                                  // complain if the '--credentials' argument isn't supplied
    .argv,                                                  // return it back as an object
  _           = require('lodash'),                          // Use lodash for chunking the results
  redis       = require('redis'),                           // node_redis module
  rk          = require('rk'),                              // Concats strings together with a ":"
  Table       = require('cli-table'),                       // pretty tables for the CLI
  credentails = require(argv.credentials),                  // Our credentials are stored in a node_redis connection object - see https://github.com/NodeRedis/node_redis#rediscreateclient
  client      = redis.createClient(credentails),            // Client object for connection to the Redis server
  keyRoot     = 'redishop',                                 // All keys start with this
  items       = rk(keyRoot,'items','*');                    // the key `redishop:items:*` (the * will be replaced with the member in sort)


function sortedValues() {
  if (argv.perf) {
    console.time('totalExecutionTime');                     // Start a timer to see how long our operation takes.
    console.time('justRedisTime');                          // This timer only shows the time it takes for Redis to return - not the JS to process the data.
  }
  client.sort(                                              // SORT command
    rk(keyRoot,'all-items'),                                // with the key `redishop:all-items` (a set)
    'BY', items+'->price',                                  // 'BY' then 'redishop:items:*->price' (these are two separate arguments to the client library)
    'GET', '#',                                             // 'GET' then '#' to get the slug (aka member from the set)
    'GET', items+'->price',                                 // 'GET' then 'redishop:items:*->price' to get the price from the hash
    'GET', items+'->name',                                  // 'GET' then 'redishop:items:*->name' to get the name from the hash
    function(err,itemData) {
      var itemsTable;

      if (argv.perf) { 
        console.timeEnd('justRedisTime');                   // This will measure just the time it takes to get a minimal Redis response with no further processing
      }
      if (err) { throw err; }                               // if err is set to a non-null value then we've got a problem

      itemsTable = new Table({                              // create a pretty table
        head: ['Slug', 'Price', 'Name']                     // with three columns
      });

      _(itemData)                                           // Create the lodash object - we use lodash because it has a nice 'chunk' function
        .chunk(3)                                           // Chunk divides up an array every n elements which is great for Redis output
        .forEach(function(anItem) {                         // The array is now nested (e.g. [ [... , ..., ...], ... ])
          itemsTable.push(anItem);                          // push the nested array into the pretty table
        });
      
        if (argv.perf) {
          console.timeEnd('totalExecutionTime');            // End the timer, display before the pretty table (timing the operation, not the output)
        }

      console.log(itemsTable.toString());                   // render out the pretty table
      console.log(itemsTable.length);                       // number of rows
      client.quit();                                        // Properly quit the client connection
    }
  );
}

if (argv.perf) {                                            // If we supply the --perf switch it'll measure the speed
  client.on('ready',function() {                            // Normally you don't need this as node_redis will queue up commands as you are establishing a connection, but to get a clean perf, you need to wait until read
    sortedValues();
  });
}

if (!argv.perf) {                                           // If not running perf
  sortedValues();                                           // Then just run the betweenRange function, it'll queue up
}
  