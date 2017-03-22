var
  argv        = require('yargs')                            // `yargs' is a command line parser
    .demand('credentials')                                  // complain if the '--credentials' argument isn't supplied
    .argv,                                                  // return it back as an object
  async       = require('async'),                           // handle asynchronous code more intuitively
  redis       = require('redis'),                           // node_redis module
  rk          = require('rk'),                              // Concats strings together with a ":"
  items       = require(
    '../node_modules/ecommerce-sample-set/companies.json'
  ),                                                        // Sample companies

  credentails = require(argv.credentials),                  // Our credentials are stored in a node_redis connection object - see https://github.com/NodeRedis/node_redis#rediscreateclient
  client      = redis.createClient(credentails),            // Client object for connection to the Redis server
  keyRoot     = 'redishop';                                 // All keys start with this

async.each(items, function(anItem,cb) {                     // Run the function for each company in the array
  console.log(anItem.slug);                                 // Log the slug
  
  client                                                    // refer to the client object which represents a single connection
    .multi()                                                // start a MULTI/EXEC block
    .hmset(                                                 // HMSET to set multiple fields/values in one command call
      rk(keyRoot,'companies',anItem.slug),                  // first argument is the key "redishop:items:[slug]"
      
      'name',                                               // field
      anItem.name,                                          // value
      
      'address',
      anItem.address,
      
      'city',
      anItem.city,

      'state',
      anItem.state,

      'zip',
      anItem.zip,

      'account',
      anItem.account,

      'contact',
      anItem.contact
    )
    .sadd(                                                  // add to a set 
      rk(keyRoot,'all-manufacturer'),                       // at the key "redishop:all-items"
      anItem.slug                                           // with the slug as the value
    )

    .exec(function(err) {                                   // Run the queued commands
      cb(err);                                              // Execute the callback function with just the error (which may or may not be null)
    });
}, function(err) {
  if (err) { throw err; }                                   // Throw an error if anything failed
  console.log('Companies added.');
  client.quit();                                            // Properly quit the client connection
});
