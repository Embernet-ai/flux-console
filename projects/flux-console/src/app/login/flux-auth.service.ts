/*
    Copyright Fireball Industries

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    LoginServiceClass,
    SettingsServiceClass,
    GrowlerService,
    GrowlerModel,
    SETTINGS_SERVICE
} from 'flux-console-lib';
import { Observable, of, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

/**
 * FluxAuthService — authenticates the Flux Console SPA against the
 * dashboard's SQLite-backed auth endpoints (/api/flux/auth/*).
 *
 * Replaces ControllerLoginService which called the Ziti Controller's
 * POST /authenticate directly. All authentication now goes through
 * the dashboard backend, which manages _flux_session cookies.
 */
@Injectable({
    providedIn: 'root'
})
export class FluxAuthService extends LoginServiceClass {

    /** Current authenticated user info (from /api/flux/auth/me or /api/flux/auth/login) */
    public fluxUser: any = null;

    constructor(
        override httpClient: HttpClient,
        @Inject(SETTINGS_SERVICE) override settingsService: SettingsServiceClass,
        override router: Router,
        override growlerService: GrowlerService,
    ) {
        super(httpClient, settingsService, router, growlerService);
    }

    /**
     * Called during APP_INITIALIZER. Checks for an existing valid
     * _flux_session cookie by calling GET /api/flux/auth/me.
     * If valid, configures the session so the app loads directly.
     * If not, clears any stale local state so the login form shows.
     */
    async init(): Promise<any> {
        try {
            const response: any = await firstValueFrom(
                this.httpClient.get('/api/flux/auth/me', { withCredentials: true })
            );
            if (response?.email) {
                this.setFluxSession(response);
                return response;
            }
        } catch (err) {
            // Not authenticated — clear any stale local session data
        }
        this.clearLocalSession();
        return Promise.resolve();
    }

    /**
     * Login via POST /api/flux/auth/login with email + password.
     * The backend validates the bcrypt hash from SQLite and sets
     * the _flux_session cookie on success.
     *
     * The prefix/url params are kept for interface compatibility but
     * are not used — all requests go to /api/flux/auth/login.
     */
    async login(
        prefix: string,
        url: string,
        email: string,
        password: string,
        doNav = true,
        type?: any,
        token?: any,
        isTest?: any
    ): Promise<any> {
        try {
            const response: any = await firstValueFrom(
                this.httpClient.post('/api/flux/auth/login', {
                    email: email.trim().toLowerCase(),
                    password
                }, {
                    withCredentials: true,
                    headers: { 'Content-Type': 'application/json' }
                })
            );

            this.setFluxSession(response);

            if (doNav) {
                this.router.navigate(['/']);
            }

            return response;
        } catch (err: any) {
            const errorBody = err?.error;
            let errorMessage = 'Login failed';
            if (typeof errorBody === 'string') {
                try {
                    const parsed = JSON.parse(errorBody);
                    errorMessage = parsed.error || errorMessage;
                } catch {
                    errorMessage = errorBody || errorMessage;
                }
            } else if (errorBody?.error) {
                errorMessage = errorBody.error;
            }

            this.growlerService.show(new GrowlerModel(
                'error',
                'Error',
                'Login Failed',
                errorMessage,
            ));
            throw { error: errorMessage };
        }
    }

    /**
     * Required by LoginServiceClass interface.
     * Not used in the proxy flow — kept for compatibility.
     */
    observeLogin(
        serviceUrl: string,
        username?: string,
        password?: string,
        doNav?: boolean,
        type?: any,
        token?: any,
        isTest?: any
    ): Observable<any> {
        return of(false);
    }

    /**
     * In the iframe deployment the origin IS the dashboard,
     * which proxies to the Flux controller.
     */
    checkOriginForController(): Promise<any> {
        return Promise.resolve(true);
    }

    /**
     * Logout via POST /api/flux/auth/logout.
     * Clears the _flux_session cookie (server-side), local state,
     * and redirects to /login.
     */
    async logout() {
        try {
            await firstValueFrom(
                this.httpClient.post('/api/flux/auth/logout', {}, {
                    withCredentials: true
                })
            );
        } catch (err) {
            // Ignore errors on logout — cookie may already be expired
        }
        this.clearLocalSession();
        this.fluxUser = null;
        this.router.navigate(['/login']);
    }

    /**
     * Clear local session state (no server call).
     */
    clearSession(): Promise<any> {
        this.clearLocalSession();
        this.fluxUser = null;
        return Promise.resolve();
    }

    // ── Private helpers ──────────────────────────────────────────────

    /**
     * Configure local settings after a successful authentication.
     * Sets selectedEdgeController to the dashboard proxy URL so all
     * API calls route through /api/flux/mgmt/*.
     */
    private setFluxSession(user: any) {
        this.fluxUser = user;
        const baseUrl = window.location.origin + '/api/flux/mgmt';

        // Set session flag so hasSession() returns true.
        // The actual session lives in the _flux_session cookie.
        this.settingsService.settings.session = {
            id: 'flux-session-active',
            controllerDomain: baseUrl,
            authorization: 100,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };

        // Route all API calls through the dashboard proxy
        this.settingsService.settings.selectedEdgeController = baseUrl;

        // Configure API version paths for the proxy
        this.settingsService.apiVersions = {
            'edge-management': {
                v1: {
                    apiBaseUrls: [baseUrl + '/edge/management/v1'],
                    path: '/edge/management/v1'
                }
            },
            'edge-client': {
                v1: {
                    apiBaseUrls: [baseUrl + '/edge/client/v1'],
                    path: '/edge/client/v1'
                }
            },
            'edge': {
                v1: {
                    apiBaseUrls: [baseUrl + '/edge/client/v1'],
                    path: '/edge/client/v1'
                }
            }
        };

        // Store user info for display
        this.settingsService.settings.fluxUser = user;

        // Persist and notify subscribers
        this.settingsService.set(this.settingsService.settings);
    }

    /**
     * Clear all local session state so hasSession() returns false.
     */
    private clearLocalSession() {
        localStorage.removeItem('ziti.settings');
        if (this.settingsService?.settings) {
            this.settingsService.settings.session = {};
            this.settingsService.settings.selectedEdgeController = '';
            this.settingsService.settings.fluxUser = null;
            this.settingsService.set(this.settingsService.settings);
        }
    }
}
