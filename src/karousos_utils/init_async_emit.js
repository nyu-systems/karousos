const EventEmitter = require('events');
//JENNY:
var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function' ?
    R.apply :
    function ReflectApply(target, receiver, args) {
        return Function.prototype.apply.call(target, receiver, args);
    }

module.exports = function init_async_emit() {
    //JENNY: extend EventEmitter with async emit
    EventEmitter.prototype.myEmit = async function(type, ...args) {
        var args = [];
        for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
        var doError = (type === 'error');

        var events = this._events;
        if (events !== undefined)
            doError = (doError && events.error === undefined);
        else if (!doError)
            return false;

        // If there is no 'error' event listener then throw.
        if (doError) {
            var er;
            if (args.length > 0)
                er = args[0];
            if (er instanceof Error) {
                // Note: The comments on the `throw` lines are intentional, they show
                // up in Node's output if this results in an unhandled exception.
                throw er; // Unhandled 'error' event
            }
            // At least give some kind of context to the user
            var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
            err.context = er;
            throw err; // Unhandled 'error' event
        }

        var handler = events[type];
        if (handler === undefined)
            return false;

        const promises = [];

        if (typeof handler === 'function') {
            promises.push(handler);
        } else {
            const len = handler.length;
            for (let i = 0; i < len; i++) {
                promises.push(handler[i]);
            }
        }

        const resolvedPromise = Promise.resolve();

        await resolvedPromise;
        await Promise.all(promises.map(async listener => {
            ReflectApply(listener, this, args);
        }));
    }
}