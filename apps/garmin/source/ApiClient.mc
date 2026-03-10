using Toybox.Communications;
using Toybox.Application.Properties;
using Toybox.Lang;
using Toybox.System;
using Toybox.Time;

class ApiClient {
    static const FALLBACK_URL = "https://scorebrawl.com";
    static const FALLBACK_KEY = "";

    static function getBaseUrl() as Lang.String {
        try {
            var url = Properties.getValue("serverUrl");
            if (url != null && !(url as Lang.String).equals("")) {
                return url as Lang.String;
            }
        } catch (e instanceof Lang.Exception) {
        }
        return FALLBACK_URL;
    }

    static function getApiKey() as Lang.String? {
        try {
            var key = Properties.getValue("apiKey");
            if (key != null && !(key as Lang.String).equals("")) {
                return key as Lang.String;
            }
        } catch (e instanceof Lang.Exception) {
        }
        return FALLBACK_KEY;
    }

    static function cacheBust(url as Lang.String) as Lang.String {
        var t = Time.now().value();
        if (url.find("?") != null) {
            return url + "&_t=" + t;
        }
        return url + "?_t=" + t;
    }

    static function get(path as Lang.String, callback as Lang.Method) as Void {
        var url = cacheBust(getBaseUrl() + "/api/device" + path);
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => {
                "x-api-key" => getApiKey()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(url, null, options, callback);
    }

    static function post(path as Lang.String, params as Lang.Dictionary or Null, callback as Lang.Method) as Void {
        var url = getBaseUrl() + "/api/device" + path;
        if (params != null) {
            var sep = "?";
            var keys = params.keys();
            for (var i = 0; i < keys.size(); i++) {
                var key = keys[i];
                url = url + sep + key + "=" + params[key];
                sep = "&";
            }
        }
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => {
                "x-api-key" => getApiKey()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(url, null, options, callback);
    }
}
