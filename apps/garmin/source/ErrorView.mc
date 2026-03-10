using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Lang;

class ErrorView extends WatchUi.View {
    var _message as Lang.String;

    function initialize(message as Lang.String) {
        View.initialize();
        _message = message;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.drawText(
            dc.getWidth() / 2,
            dc.getHeight() / 2,
            Graphics.FONT_SMALL,
            _message,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER
        );
    }
}
