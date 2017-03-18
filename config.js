var fs = require('fs');

const configFile = __dirname + "/config.json";
module.exports = JSON.parse(fs.readFileSync(configFile));
