const args = process.argv;

var Cron = require('./cron.js');

try {
    var interval = Cron.parse(args[2]);
    console.table(interval)
  } catch (err) {
    console.log('Error: ' + err.message);
  }