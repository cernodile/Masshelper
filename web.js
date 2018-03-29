var http = require("http");
var https = require("https");
var config = require("./config.json");
var enableSSL = config.ssl;
var fs = require("fs");
const spawn = require('child_process').fork;
var caching = {
  "css": 86400,
  "png": 86400 / 2
};
const Constants = {
  RL_LIMIT: 9,
  VALID_ENDPOINTS: config.endpoints
};
String.prototype.capitalize = function(){
  return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
};
var ratelimits = new Map();
var server = http.createServer(handleReq);
server.listen(80);
if (enableSSL) {
  var httpsServer = https.createServer({"key": fs.readFileSync("/etc/letsencrypt/live/" + config.domain + "/privkey.pem"), "cert": fs.readFileSync("/etc/letsencrypt/live/" + config.domain + "/cert.pem")}, handleReq);
  httpsServer.listen(443);
}
function handleReq (req, res) {
  var parsedAddr = req.connection.remoteAddress.replace("::1", "You").replace("::ffff:", "");
  if (req.url !== "/favicon.ico" && !req.url.includes("apple")) console.log(`[${new Date().toLocaleTimeString()}] ${parsedAddr} fetched ${req.url}`);
  if (req.url.startsWith("/query/")) {
    var parseUrl = req.url.split("/");
    var stub = parseUrl[1];
    var item = parseUrl[3];
    var compact = parseUrl[4] || "false";
    compact = compact.replace("compact", "true");
    var classic = parseUrl[5] || "true";
    var endpoint = parseUrl[2];
    if (Constants.VALID_ENDPOINTS.indexOf(endpoint) === -1) {
      var page = fs.readFileSync("./templates/error/404.html", "utf-8");
      res.writeHead(404, {"Content-Type": "text/html; charset=utf-8"});
      res.write(page);
      res.end();
      return;
    }
    if (!ratelimits.has(parsedAddr)) {
      var x = ratelimits.set(parsedAddr, {"limit": Constants.RL_LIMIT, "used": 1});
      x.reset = setInterval(() => {
        ratelimits.get(parsedAddr).used = 0;
      }, 60000);
    } else {
      var x = ratelimits.get(parsedAddr);
      if (x.used > x.limit) {
        var page = fs.readFileSync("./templates/error/429.html", "utf-8");
        res.writeHead(429, {"Content-Type": "text/html; charset=utf-8"});
        res.write(page)
        return res.end();
      } else x.used++;
    }
    var cProcess = spawn("cli.js", [endpoint, decodeURI(item).toLowerCase(), 100, compact, classic], {silent: true});
    cProcess.on("message", (data, status) => {
      var page = fs.readFileSync("./templates/query.html", "utf-8");
      page = page.replace("${result}", "<pre class='" + (data.startsWith("ERR:") ? "fail" : "success") + "'><code>" + data + "</code></pre>");
      page = page.replace(`href="/"`, `href="/${endpoint}"`);
      page = page.replace(`charset="utf-8">`, `charset="utf-8">\n<link rel="stylesheet" type="text/css" href="/${endpoint}.css" charset="utf-8">`);
      page = page.replace("${disclaimer}", config.disclaimer[endpoint]);
      page = page.replace("${endpoint}", '"' + endpoint + '";');
      res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      res.write(page);
      res.end();
    });
  } else if (req.url.startsWith("/search/")) {
    var parseUrl = req.url.split("/");
    var stub = parseUrl[1];
    var endpoint = parseUrl[2];
    var search = decodeURI(parseUrl[3]) || "";
    if (Constants.VALID_ENDPOINTS.indexOf(endpoint) === -1) {
      var page = fs.readFileSync("./templates/error/404.html", "utf-8");
      res.writeHead(404, {"Content-Type": "text/html; charset=utf-8"});
      res.write(page);
      res.end();
      return;
    }
    if (search.length < 2) {
      var page = fs.readFileSync("./templates/query.html", "utf-8");
      page = page.replace("${result}", "<pre class='fail'><code>Please input more than 1 character in order to query search</code></pre>");
      page = page.replace(`href="/"`, `href="/${endpoint}"`);
      page = page.replace(`charset="utf-8">`, `charset="utf-8">\n<link rel="stylesheet" type="text/css" href="/${endpoint}.css" charset="utf-8">`);
      page = page.replace("${disclaimer}", config.disclaimer[endpoint]);
      page = page.replace("${endpoint}", '"' + endpoint + '";');
      res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      res.write(page);
      return res.end();
    }
    var compact = parseUrl[4] || "false";
    compact = compact.replace("compact", "true");
    var classic = parseUrl[5] || "true";
    var result = ["<ul id=\"list\">"];
    var data = JSON.parse(fs.readFileSync(config.datafiles[endpoint]));
    for (var key in data.items) {
      if (key === search.toLowerCase()) {
        res.writeHead(302, {"Location": "/query/" + endpoint + "/" + key + "/" + compact + "/" + classic});
        return res.end();
      } else if (key.includes(search.toLowerCase())) {
        result.push("<a href=\"/query/" + endpoint + "/" + key + "/" + compact + "/" + classic +"\">" + key.capitalize() + "</a>");
      }
    }
    result.push("</ul>");
    if (result.length === 3) {
      res.writeHead(302, {"Location": "/query/" + endpoint + "/" + result[1].replace("<a href=\"/query/" + endpoint + "/", "").replace(/\/true/g, "").replace(/\/false/g, "").split('"')[0] + "/" + compact + "/" + classic});
      return res.end();
    }
    var page = fs.readFileSync("./templates/query.html", "utf-8");
    page = page.replace("${result}", result.join("\n"));
    page = page.replace(`href="/"`, `href="/${endpoint}"`);
    page = page.replace(`charset="utf-8">`, `charset="utf-8">\n<link rel="stylesheet" type="text/css" href="/${endpoint}.css" charset="utf-8">`);
    page = page.replace("${disclaimer}", config.disclaimer[endpoint]);
    page = page.replace("${endpoint}", '"' + endpoint + '";');
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.write(page);
    res.end();
  } else if (req.url.startsWith("/pb/")) {
    var base = req.url.split("/");
    var route = base[2] || null;
    var endpoint = base[3] || null;
    var search = base[4] || "";
    if (Constants.VALID_ENDPOINTS.indexOf(endpoint) === -1) {
      var page = fs.readFileSync("./templates/error/404.html", "utf-8");
      res.writeHead(404, {"Content-Type": "text/html; charset=utf-8"});
      res.write(page);
      res.end();
      return;
    }
    if (search.length < 2) {
      var page = fs.readFileSync("./templates/query.html", "utf-8");
      page = page.replace("${result}", "<pre class='fail'><code>Please input more than 1 character in order to query search</code></pre>");
      res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      res.write(page);
      return res.end();
    }
    switch (route) {
      case "search":
        var result = ["<ul id=\"list\">"];
        var data = JSON.parse(fs.readFileSync(config.datafiles[endpoint]));
        for (var key in data.items) {
          if (key === decodeURI(search).toLowerCase()) {
            res.writeHead(302, {"Location": "/pb/query/" + endpoint + "/" + key});
            return res.end();
          } else if (key.includes(decodeURI(search).toLowerCase())) {
            result.push("<a href=\"/pb/query/" + endpoint + "/" + key + "\">" + key.capitalize() + "</a>");
          }
        }
        result.push("</ul>");
        if (result.length === 3) {
          res.writeHead(302, {"Location": "/pb/query/" + endpoint + "/" + result[1].replace("<a href=\"/pb/query/" + endpoint + "/", "").split('"')[0]});
          return res.end();
        }
        var page = fs.readFileSync("./templates/query.html", "utf-8");
        page = page.replace("${result}", result.join("\n"));
        page = page.replace(`href="/"`, `href="/${endpoint}"`);
        page = page.replace(`charset="utf-8">`, `charset="utf-8">\n<link rel="stylesheet" type="text/css" href="/${endpoint}.css" charset="utf-8">`);
        page = page.replace("${disclaimer}", config.disclaimer[endpoint]);
        page = page.replace("${endpoint}", '"' + endpoint + '";');
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.write(page);
        res.end();
        return;
      case "query":
        if (!ratelimits.has(parsedAddr)) {
          var x = ratelimits.set(parsedAddr, {"limit": Constants.RL_LIMIT, "used": 1});
          x.reset = setInterval(() => {
            ratelimits.get(parsedAddr).used = 0;
          }, 60000);
        } else {
          var x = ratelimits.get(parsedAddr);
          if (x.used > x.limit) {
            var page = fs.readFileSync("./templates/error/429.html", "utf-8");
            res.writeHead(429, {"Content-Type": "text/html; charset=utf-8"});
            res.write(page)
            return res.end();
          } else x.used++;
        }
        var cProcess = spawn("possibilities.js", [endpoint, decodeURI(search).toLowerCase()], {silent: true});
        cProcess.on("message", (data, status) => {
          var page = fs.readFileSync("./templates/query.html", "utf-8");
          page = page.replace("${result}", "<pre class='" + (data.startsWith("ERR:") ? "fail" : "success") + "'><code>" + data + "</code></pre>");
          page = page.replace(`href="/"`, `href="/${endpoint}"`);
          page = page.replace(`charset="utf-8">`, `charset="utf-8">\n<link rel="stylesheet" type="text/css" href="/${endpoint}.css" charset="utf-8">`);
          page = page.replace("${disclaimer}", config.disclaimer[endpoint]);
          page = page.replace("${endpoint}", '"' + endpoint + '";');
          res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
          res.write(page);
          res.end();
        });
        return;
    }
  } else {
    switch (req.url) {
      case "/global.css":
        var page = fs.readFileSync("./templates/global.css", "utf-8");
        res.writeHead(200, {"Content-Type": "text/css; charset=utf-8;", "Cache-Control" : "public, max-age=" + caching["css"]});
        res.write(page);
        res.end();
        return;
      case "/spritesheet":
        var page = fs.readFileSync("./templates/spritesheet.webp");
        res.writeHead(200, {"Content-Type": "image/webp;", "Cache-Control" : "public, max-age=" + caching["png"]});
        res.write(page);
        res.end();
        return;
      case "/seedsheet":
        var page = fs.readFileSync("./templates/seedsprites.webp");
        res.writeHead(200, {"Content-Type": "image/webp;", "Cache-Control" : "public, max-age=" + caching["png"]});
        res.write(page);
        res.end();
        return;
      case "/":
        var page = fs.readFileSync("./templates/index.html", "utf-8");
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.write(page);
        res.end();
        return;
      case "/growtopia":
        var page = fs.readFileSync("./templates/growtopia.html", "utf-8");
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.write(page);
        res.end();
        return;
      case "/growtopia.css":
        var page = fs.readFileSync("./templates/growtopia.css", "utf-8");
        res.writeHead(200, {"Content-Type": "text/css; charset=utf-8;", "Cache-Control" : "public, max-age=" + caching["css"]});
        res.write(page);
        res.end();
        return;
      case "/pixelworlds":
        var page = fs.readFileSync("./templates/pixelworlds.html", "utf-8");
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.write(page);
        res.end();
        return;
      case "/pixelworlds.css":
        var page = fs.readFileSync("./templates/pixelworlds.css", "utf-8");
        res.writeHead(200, {"Content-Type": "text/css; charset=utf-8;", "Cache-Control" : "public, max-age=" + caching["css"]});
        res.write(page);
        res.end();
        return;
      case "/pixelworlds/background":
        var page = fs.readFileSync("./data/images/space.png");
        // You need to get these assets from Pixel Worlds press kit, sorry!
        res.writeHead(200, {"Content-Type": "image/webp;", "Cache-Control" : "public, max-age=" + caching["png"]});
        res.write(page);
        res.end();
        return;
      case "/pixelworlds/person":
        var page = fs.readFileSync("./data/images/person.png");
        res.writeHead(200, {"Content-Type": "image/webp;", "Cache-Control" : "public, max-age=" + caching["png"]});
        res.write(page);
        res.end();
        return;
      case "/pixelworlds/logo":
        var page = fs.readFileSync("./data/images/logo.png");
        res.writeHead(200, {"Content-Type": "image/webp;", "Cache-Control" : "public, max-age=" + caching["png"]});
        res.write(page);
        res.end();
        return;
      default:
        var page = fs.readFileSync("./templates/error/404.html", "utf-8");
        res.writeHead(404, {"Content-Type": "text/html; charset=utf-8"});
        res.write(page);
        res.end();
        return;
    }
  }
}
