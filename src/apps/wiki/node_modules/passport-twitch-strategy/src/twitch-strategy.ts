import fetch from "node-fetch";
import OAuth2Strategy from "passport-oauth2";

interface Options {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope: string;
}

export class Strategy extends OAuth2Strategy {
    private clientID: string;
    public name: string;
    /**
     * `Strategy` constructor.
     *
     * The Twitch authentication strategy authenticates requests by delegating to
     * Twitch using the OAuth 2.0 protocol.
     *
     * Applications must supply a `verify` callback which accepts an `accessToken`,
     * `refreshToken` and service-specific `profile`, and then calls the `done`
     * callback supplying a `user`, which should be set to `false` if the
     * credentials are not valid.  If an exception occured, `err` should be set.
     *
     * Options:
     *   - `clientID`      your Twitch application"s client id
     *   - `clientSecret`  your Twitch application"s client secret
     *   - `callbackURL`   URL to which Twitch will redirect the user after granting authorization
     *
     * Examples:
     *
     *     passport.use(new TwitchStrategy({
     *         clientID: "123-456-789",
     *         clientSecret: "shhh-its-a-secret"
     *         callbackURL: "https://www.example.net/auth/twitch/callback"
     *       },
     *       function(accessToken, refreshToken, profile, done) {
     *         User.findOrCreate(..., function (err, user) {
     *           done(err, user);
     *         });
     *       }
     *     ));
     *
     * @param {Options} options
     * @param {Function} verify
     */
    constructor(options: Options, verify: Function) {
        const params: OAuth2Strategy._StrategyOptionsBase = {
            ...options,
            authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
            tokenURL: 'https://id.twitch.tv/oauth2/token'
        }
        super(params, verify as OAuth2Strategy.VerifyFunction | OAuth2Strategy.VerifyFunctionWithRequest);
        this.name = 'twitch';
        this.clientID = options.clientID;
        this._oauth2.setAuthMethod('Bearer');
        this._oauth2.useAuthorizationHeaderforGET(true);
    }

    /**
     * Retrieve user profile from Twitch.
     * This function constructs a normalized profile, with the following properties:
     *   - `provider`         always set to `twitch`
     *   - `id`
     *   - `login`
     *   - `displayName`
     * @param {String} accessToken
     * @param {Function} done
     * @api protected
     */
    userProfile(accessToken: string, done: (err?: Error | null, profile?: any) => void) {
        return fetch('https://api.twitch.tv/helix/users', {
            method: 'GET',
            headers: {
                'Client-ID': this.clientID,
                'Accept': 'application/vnd.twitchtv.v5+json',
                'Authorization': 'Bearer ' + accessToken
            }
        }).then(response => {
            if (!response.ok) throw new OAuth2Strategy.InternalOAuthError("failed to fetch user profile", response);
            else return response.json();
        }).then(json => {
            const body = json.data[0];
            body.provider = 'twitch';
            if (body.display_name) {
                body.displayName = body.display_name;
                delete body.display_name;
            }
            return done(null, body);
        }).catch(error => {
            return done(error, null);
        });
    }

    authenticate(req: any, args?: any): void {
        super.authenticate(req, args);
    }

    /**
     * Return extra parameters to be included in the authorization request.
     * @param {{ forceVerify?: boolean }} options
     * @return {Object}
     * @api protected
     */
    authorizationParams(options: { forceVerify?: boolean }): object {
        return {
            force_verify: (typeof options.forceVerify !== 'boolean') ? false : options.forceVerify
        };
    }
}

export default Strategy;