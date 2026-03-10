using Toybox.WatchUi;
using Toybox.Timer;
using Toybox.Lang;

class ScoreEntryDelegate extends WatchUi.BehaviorDelegate {
    var _leagueSlug as Lang.String;
    var _debounceTimer as Timer.Timer?;
    var _pendingHomeScore as Lang.Number?;
    var _pendingAwayScore as Lang.Number?;

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
        view.markUserChange();
        WatchUi.requestUpdate();
        scheduleLiveScoreUpdate(view);
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
        view.markUserChange();
        WatchUi.requestUpdate();
        scheduleLiveScoreUpdate(view);
        return true;
    }

    function scheduleLiveScoreUpdate(view as ScoreEntryView) as Void {
        _pendingHomeScore = view._homeScore;
        _pendingAwayScore = view._awayScore;

        if (_debounceTimer != null) {
            _debounceTimer.stop();
        }

        _debounceTimer = new Timer.Timer();
        _debounceTimer.start(method(:sendDebouncedScoreUpdate), 500, false);
    }

    function sendDebouncedScoreUpdate() as Void {
        if (_pendingHomeScore == null || _pendingAwayScore == null) { return; }

        ApiClient.post(
            "/leagues/" + _leagueSlug + "/session/update-score",
            {
                "homeScore" => _pendingHomeScore,
                "awayScore" => _pendingAwayScore
            },
            method(:onLiveScoreResponse)
        );

        _pendingHomeScore = null;
        _pendingAwayScore = null;
        _debounceTimer = null;
    }

    function onLiveScoreResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        // Silent response - no UI update needed for live scores
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
            sendImmediateScoreUpdate(view);
            WatchUi.requestUpdate();
            return true;
        }

        view._confirming = true;
        sendImmediateScoreUpdate(view);
        WatchUi.requestUpdate();
        return true;
    }

    function sendImmediateScoreUpdate(view as ScoreEntryView) as Void {
        view.markUserChange();
        ApiClient.post(
            "/leagues/" + _leagueSlug + "/session/update-score",
            {
                "homeScore" => view._homeScore,
                "awayScore" => view._awayScore
            },
            method(:onLiveScoreResponse)
        );
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
        // Cancel any pending debounce timer to avoid conflicts
        if (_debounceTimer != null) {
            _debounceTimer.stop();
            _debounceTimer = null;
        }
        _pendingHomeScore = null;
        _pendingAwayScore = null;

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
