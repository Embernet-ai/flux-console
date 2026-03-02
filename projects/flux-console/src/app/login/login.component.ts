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

import { Inject, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoginServiceClass, SettingsServiceClass, SETTINGS_SERVICE, ZAC_LOGIN_SERVICE } from 'flux-console-lib';
import { FluxAuthService } from './flux-auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class LoginComponent implements OnInit {
    email = '';
    password = '';
    isLoading = false;
    errorMessage = '';

    constructor(
        @Inject(ZAC_LOGIN_SERVICE) public svc: FluxAuthService,
        @Inject(SETTINGS_SERVICE) private settingsService: SettingsServiceClass,
        private router: Router,
    ) {}

    ngOnInit() {
        // If already authenticated (session cookie valid), skip login
        if (this.settingsService.hasSession()) {
            this.router.navigate(['/']);
        }
    }

    /**
     * Handle login form submission.
     * POSTs to /api/flux/auth/login with email + password.
     * On success, the backend sets the _flux_session cookie and
     * we navigate to the dashboard.
     */
    async login() {
        this.errorMessage = '';

        if (!this.email.trim() || !this.password) {
            this.errorMessage = 'Email and password are required';
            return;
        }

        this.isLoading = true;
        try {
            await this.svc.login('', '', this.email, this.password, true);
        } catch (err: any) {
            this.errorMessage = err?.error || 'Login failed. Please try again.';
        } finally {
            this.isLoading = false;
        }
    }

    /** Allow Enter key to submit the form */
    onKeyUp(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            this.login();
        }
    }
}
