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
  items       = rk(keyRoot,'items','*'),                    // the key `redishop:items:*` (the * will be replaced with the member in sort)
  companies   = rk(keyRoot,'companies','*');


function sortedValues() {
  if (argv.perf) {
    console.time('totalExecutionTime');                     // Start a timer to see how long our operation takes.
    console.time('justRedisTime');                          // This timer only shows the time it takes for Redis to return - not the JS to process the data.
  }
  client
    .multi()
    .sort(                                                  // SORT command
      rk(keyRoot,'priceIndex'),
      'BY', 'nosort',                                       // 'nosort' on a zset will go by score
      'GET', '#',                                           // 'GET' then '#' to get the slug (aka member from the set)
      'GET', items+'->price',                               // 'GET' then 'redishop:items:*->price' to get the price from the hash
      'GET', items+'->name'                                 // 'GET' then 'redishop:items:*->name' to get the name from the hash
    )
    .sort(                                                  // SORT command
      rk(keyRoot,'sorted','items-manufacturer','price'),    // the list that we prepared when adding the item
      'BY', 'nosort',                                       // the natural order of the list
      'GET', companies+'->name',                            // 'GET' then 'redishop:companies:*->name' to get the name of the company
      'GET', companies+'->address'                          // 'GET' then 'redishop:companies:*->address' to get the address of the company
    )
    .exec(function(err,multiResponses) {
      var 
        itemsTable,
        itemData        = multiResponses[0],
        companyData     = multiResponses[1];

      if (argv.perf) { 
        console.timeEnd('justRedisTime');                   // This will measure just the time it takes to get a minimal Redis response with no further processing
      }
      if (err) { throw err; }                               // if err is set to a non-null value then we've got a problem

      itemsTable = new Table({                              // create a pretty table
        head: [
          'Slug', 
          'Price', 
          'Name',
          'Company',
          'Commpany Address'
        ]                                                   // with five columns
      });
      
      itemData = _.chunk(itemData, 3);
      companyData = _.chunk(companyData, 2);
      
      itemData.forEach(function(itemData,index) {
        itemsTable.push(
          itemData.concat(companyData[index])
        );
      });

      if (argv.perf) {
        console.timeEnd('totalExecutionTime');              // End the timer, display before the pretty table (timing the operation, not the output)
      }

      console.log(itemsTable.toString());                   // render out the pretty table
      console.log(itemsTable.length);                       // number of rows
      client.quit();                                        // Properly quit the client connection
    }
  );
}

if (argv.perf) {                                            // If we supply the --perf switch it'll measure the speed
  client.on('ready',function() {                            // Normally you don't need this as node_redis will queue up commands as you are establishing a connection, but to get a clean perf, you need to wait until ready
    sortedValues();
  });
}

if (!argv.perf) {                                           // If not running perf
  sortedValues();                                           // Then just run the betweenRange function, it'll queue up
}
  