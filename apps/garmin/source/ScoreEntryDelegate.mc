using Toybox.WatchUi;
using Toybox.Timer;
using Toybox.Lang;

class ScoreEntryDelegate extends WatchUi.BehaviorDelegate {
    var _leagueSlug as Lang.String;

    function initialize(leagueSlug as Lang.String) {
        BehaviorDelegate.initialize();
        _leagueSlug = leagueSlug;
    }

    function getView() as ScoreEntryView? {
        var view = WatchUi.getCurrentView()[0];
        if (view instanceof ScoreEntryView) {
            return view as ScoreEntryView;
        }
        return null;
    }

    function onNextPage() as Lang.Boolean {
        var view = getView();
        if (view == null || view._confirming || view._submitting) { return false; }
        if (view._activeField == 0) {
            view._homeScore++;
        } else {
            view._awayScore++;
        }
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() as Lang.Boolean {
        var view = getView();
        if (view == null || view._confirming || view._submitting) { return false; }
        if (view._activeField == 0) {
            if (view._homeScore > 0) { view._homeScore--; }
        } else {
            if (view._awayScore > 0) { view._awayScore--; }
        }
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() as Lang.Boolean {
        var view = getView();
        if (view == null || view._submitting) { return false; }

        if (view._confirming) {
            submitScore(view);
            return true;
        }

        if (view._activeField == 0) {
            view._activeField = 1;
            WatchUi.requestUpdate();
            return true;
        }

        view._confirming = true;
        WatchUi.requestUpdate();
        return true;
    }

    function onBack() as Lang.Boolean {
        var view = getView();
        if (view != null && view._confirming) {
            view._confirming = false;
            WatchUi.requestUpdate();
            return true;
        }
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }

    function submitScore(view as ScoreEntryView) as Void {
        view._submitting = true;
        view._error = null;
        WatchUi.requestUpdate();

        ApiClient.post(
            "/leagues/" + _leagueSlug + "/session/record-result",
            {
                "homeScore" => view._homeScore,
                "awayScore" => view._awayScore
            },
            method(:onRecordResponse)
        );
    }

    function onRecordResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        if (responseCode == 200) {
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            var parentView = WatchUi.getCurrentView()[0];
            if (parentView instanceof SessionView) {
                (parentView as SessionView).fetchSession();
            }
        } else {
            var view = getView();
            if (view != null) {
                view._submitting = false;
                view._confirming = false;
                view._error = "Failed (" + responseCode + ")";
                WatchUi.requestUpdate();
            }
        }
    }
}
