// config/FrontendUrl.js
const getFrontendUrl = () => {
    // Simple version - detect network and return appropriate URL
    const interfaces = require('os').networkInterfaces();
    
    for (const interfaceName in interfaces) {
      for (const config of interfaces[interfaceName]) {
        if (config.family === 'IPv4' && !config.internal) {
         
          if (config.address.includes('10.129.')) {
            return 'http://10.129.103.2:5173';
          } else if (config.address.includes('192.168.')) {
            return 'http://192.168.1.27:5173';
          } else if (config.address.includes('10.85.')) {
            return 'http://10.85.180.2:5173';
          }
        }
      }
    }
    
    // Fallback to localhost if no network IP found
    console.log('No network IP found, using localhost');
    return 'http://localhost:5173';
};

module.exports = getFrontendUrl;