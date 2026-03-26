using Toybox.Application;
using Toybox.WatchUi;
using Toybox.Lang;

class ScoreBrawlApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        var apiKey = ApiClient.getApiKey();
        if (apiKey == null || apiKey.equals("")) {
            return [new ErrorView("Set API key\nin Garmin Connect")];
        }
        return [new LeaguePickerView(), new LeaguePickerDelegate()];
    }

    function onTerminate() as Void {
        var view = WatchUi.getCurrentView()[0];
        if (view instanceof SessionView) {
            (view as SessionView).stopTimer();
        }
    }
}
