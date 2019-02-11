import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Geolocation, GeolocationOptions, Geoposition } from '@ionic-native/geolocation';
import { Diagnostic } from '@ionic-native/diagnostic';
import { Platform, LoadingController, AlertController, AlertOptions } from 'ionic-angular';
import { switchMap, catchError, first, map, tap } from 'rxjs/operators';

export function getLazy<T = any>(promiseFactory: (...thisArgs: any[]) => Promise<T>, ...args: any[]): Observable<T> {
  return Observable.defer(() => Observable.fromPromise(promiseFactory(...args)));
}

export class UserDontWantToEnableGeolocationError extends Error {}
export class UserDontWantToAuthorizeGeolocationError extends Error {}
export class GettingGeolocationError extends Error {}

/*
  Generated class for the GeolocationProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class GeolocationProvider {

  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 60000,
    maximumAge: 0,
  };

  constructor(
    private platform: Platform,
    private diagnostic: Diagnostic,
    private geolocation: Geolocation,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
  ) {
    console.log('Geolocation 0: Hello GeolocationProvider Provider');
  }

  private isAuthorizedCheck(authorization: string): boolean {
    return authorization === this.diagnostic.locationAuthorizationMode.ALWAYS
      || authorization === this.diagnostic.locationAuthorizationMode.WHEN_IN_USE
      || authorization === this.diagnostic.permissionStatus.GRANTED
      || authorization === this.diagnostic.permissionStatus.GRANTED_WHEN_IN_USE
      || authorization === this.diagnostic.permissionStatus.RESTRICTED;
  }

  private checkWantsToUnAuthorize(): Observable<boolean> {
    return Observable.defer(() => {
      const alrtBus: Subject<boolean> = new Subject;
      const a: AlertOptions = {
      };
      const alrt = this.alertCtrl.create({
        enableBackdropDismiss: false,
        title: 'Authorization',
        message: `
          Your Geolocation is authorized at the moment.<br>
          This enable some powerful features in the application !<br>
          Are you sure you want to unauthorize it ?<br>
          You will be redirected to the settings page for this application,<br>
          go to the "authorization" panel and uncheck the switch button.<br>
          The application will restart to reload it's rights on the device.<br>
        `,
        buttons: [
          {
            text: 'Yes I want',
            handler: () => {
              alrtBus.next(true);
              alrtBus.complete();
            }
          },
          {
            text: 'Cancel',
            handler: () => {
              alrtBus.next(false);
              alrtBus.complete();
            }
          }
        ]
      });
      alrt.present();
      return alrtBus.asObservable();
    });
  }

  private checkWantsToEnable(): Observable<boolean> {
    return Observable.defer(() => {
      const alrtBus: Subject<boolean> = new Subject;
      const alrt = this.alertCtrl.create({
        enableBackdropDismiss: false,
        title: 'Authorization',
        message: `
          Your Geolocation is not enable at the moment.<br>
          You can enable some powerful features in the application by switching it on!<br>
          You cannot do it in the application, but will be redirected to the settings page for this application,<br>
          You will be redirected to the settings page for this application,<br>
          Just check the switch button for loacation authorization, and we are good to go !<br>
        `,
        buttons: [
          {
            text: 'Yes I want',
            handler: () => {
              alrtBus.next(true);
              alrtBus.complete();
            }
          },
          {
            text: 'Cancel',
            handler: () => {
              alrtBus.next(false);
              alrtBus.complete();
            }
          }
        ]
      });
      alrt.present();
      return alrtBus.asObservable();
    });
  }

  isAuthorized(): Observable<boolean> {
    return getLazy(() => this.diagnostic.isLocationAuthorized());
  }

  changeAuthorization(): Observable<boolean> {
    const isAuthorized$ = getLazy(() => this.diagnostic.isLocationAuthorized());
    const checkWantsToUnAuthorize$ = this.checkWantsToUnAuthorize();
    const setNotAuthorized$ = Observable.defer(() => {
      this.diagnostic.switchToSettings();
      return this.platform.resume.pipe(first(), switchMap(() => isAuthorized$));
    });
    const checkWantsToAuthorize$ = Observable.defer(() => Observable.of(true));
    const setAuthorized$ = getLazy(() => this.diagnostic.requestLocationAuthorization()).pipe(
      map((authorization: string) => this.isAuthorizedCheck(authorization)),
    );
    return Observable.defer(() => {
      return isAuthorized$.pipe(
        switchMap((isAuthorized: boolean) => isAuthorized
          ? checkWantsToUnAuthorize$.pipe(
            switchMap((wantsToUnAuthorize: boolean) => wantsToUnAuthorize ? setNotAuthorized$ : Observable.of(true))
          )
          : checkWantsToAuthorize$.pipe(
            switchMap((wantsToAuthorize: boolean) => wantsToAuthorize ? setAuthorized$ : Observable.of(false))
          )
        ),
      );
    });
  }

  getPosition(options: PositionOptions = this.options): Observable<Geoposition> {
    /** Building blocks */
    const isEnabled$ = getLazy(() => this.diagnostic.isLocationEnabled());
    const isAuthorized$ = getLazy(() => this.diagnostic.isLocationAuthorized());
    const launchSettings$ = getLazy(() => {
      this.diagnostic.switchToLocationSettings();
      return Promise.resolve(true);
    });
    const settingsResponse$ = this.platform.resume.pipe(first(), switchMap(() => isEnabled$));
    const checkWantsToEnable$ = this.checkWantsToEnable();
    const checkWantsToAuthorize$ = Observable.defer(() => Observable.of(true));
    const requestEnable$ = launchSettings$.pipe(switchMap(() => settingsResponse$));
    const requestAuthorize$ = getLazy(() => this.diagnostic.requestLocationAuthorization());
    const dontWantToEnable$ = Observable.throw(new UserDontWantToEnableGeolocationError('Geolocation not enable'));
    const dontWantToAuthorize$ = Observable.throw(new UserDontWantToAuthorizeGeolocationError('Geolocation not authorized'));
    const currentPosition$ = getLazy(() => this.geolocation.getCurrentPosition(options || this.options)).pipe(
      catchError((error: Error) => Observable.throw(new GettingGeolocationError(error.message)))
    );
    /** Actual logic */
    return isEnabled$.pipe(
      /** From enable to authorize */
      switchMap((isCurrentlyEnabled: boolean) => {
        if (!isCurrentlyEnabled) {
          return checkWantsToEnable$.pipe(
            switchMap((wantsToEnable: boolean) => wantsToEnable
              ? requestEnable$.pipe(
                switchMap((isEnable: boolean) => isEnable ? isAuthorized$ : dontWantToEnable$),
              ) : dontWantToEnable$
            )
          );
        } else {
          return isAuthorized$;
        }
      }),
      /** From authorize to position */
      switchMap((currentAuthorization: string) => {
        if (!currentAuthorization) {
          return checkWantsToAuthorize$.pipe(
            switchMap((wantsToAuthorize: boolean) => wantsToAuthorize
              ? requestAuthorize$.pipe(
                switchMap((authorization: string) => this.isAuthorizedCheck(authorization) ? currentPosition$ : dontWantToAuthorize$),
              ) : dontWantToAuthorize$
            )
          );
        } else {
          return currentPosition$;
        }
      }),
    );
  }

}
