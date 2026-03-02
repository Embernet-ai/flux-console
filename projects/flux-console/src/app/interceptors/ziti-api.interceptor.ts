/*
    Copyright NetFoundry Inc.

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

import {Injectable, Inject} from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';

import {Observable, catchError, throwError} from 'rxjs';
import {
    SettingsServiceClass,
    SETTINGS_SERVICE,
    ZAC_LOGIN_SERVICE,
} from "flux-console-lib";
import {Router} from "@angular/router";
import {FluxAuthService} from '../login/flux-auth.service';

/**
 * HTTP interceptor for the Flux Console iframe deployment.
 *
 * Responsibilities:
 * - Adds `withCredentials: true` to all /api/flux/ requests so the
 *   _flux_session cookie is sent with every request.
 * - Sets Content-Type and Accept headers.
 * - Handles 401 responses by clearing the session and redirecting
 *   to the login form (session expired or revoked).
 *
 * Does NOT add zt-session headers — the dashboard proxy authenticates
 * to the Flux controller using its own mTLS identity.
 */
@Injectable({
    providedIn: 'root'
})
export class ZitiApiInterceptor implements HttpInterceptor {

    private redirectingToLogin = false;

    constructor(
        @Inject(SETTINGS_SERVICE) private settingsService: SettingsServiceClass,
        @Inject(ZAC_LOGIN_SERVICE) private loginService: FluxAuthService,
        private router: Router,
    ) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Don't modify auth endpoint requests (they handle their own credentials)
        if (this.isAuthEndpoint(req)) {
            return next.handle(req);
        }

        // Clone request with withCredentials and proper headers
        const modifiedReq = this.addCredentials(req);
        return next.handle(modifiedReq).pipe(
            catchError((err: HttpErrorResponse) => this.handleErrorResponse(err))
        );
    }

    /**
     * Auth endpoints (/api/flux/auth/*) are handled directly by
     * FluxAuthService with their own withCredentials setting.
     */
    private isAuthEndpoint(req: HttpRequest<any>): boolean {
        return req.url.includes('/api/flux/auth/');
    }

    /**
     * Add withCredentials: true so the _flux_session cookie is sent,
     * and set default Content-Type / Accept headers.
     */
    private addCredentials(request: HttpRequest<any>): HttpRequest<any> {
        const contentType = request.headers.get('Content-Type') || 'application/json';
        const acceptHeader = request.headers.get('Accept') || 'application/json';

        return request.clone({
            withCredentials: true,
            setHeaders: {
                'Content-Type': contentType,
                'Accept': acceptHeader,
            }
        });
    }

    /**
     * Handle HTTP error responses. On 401 (session expired/revoked),
     * clear local session state and redirect to the login form.
     * This handles task 5.7 — graceful session expiry.
     */
    private handleErrorResponse(err: HttpErrorResponse): Observable<never> {
        if (err.status === 401 && !this.redirectingToLogin) {
            this.redirectingToLogin = true;
            // Clear local session state
            this.loginService.clearSession().then(() => {
                this.router.navigate(['/login']);
                // Reset flag after navigation completes
                setTimeout(() => { this.redirectingToLogin = false; }, 1000);
            });
        }
        return throwError(() => err);
    }
}

