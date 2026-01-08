const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude backend_python from Metro watcher
config.resolver.blockList = [
    /backend_python\/.*/,
];

module.exports = config;
