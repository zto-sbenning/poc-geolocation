import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { GeolocationProvider } from '../../providers/geolocation/geolocation';
import { Observable } from 'rxjs';
import { Geoposition } from '@ionic-native/geolocation';
import { switchMap, exhaustMap, tap, finalize } from 'rxjs/operators';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  authorized: boolean;
  latitude: number;
  longitude: number;
  errorString: string;
  gettingPosition: boolean = false;

  constructor(
    public navCtrl: NavController,
    public geolocation: GeolocationProvider
  ) { }

  ionViewDidLoad() {
    this.geolocation.isAuthorized().subscribe(
      (authorized: boolean) => {
        this.authorized = authorized;
      },
      (error: Error) => {
        this.errorString = `${error.name}: ${error.message}`;
      }
    );
  }

  getPosition() {
    if (this.gettingPosition === true) {
      return;
    }
    this.gettingPosition = true;
    this.geolocation.getPosition().pipe(
      finalize(() => {
        this.gettingPosition = false;
      })
    ).subscribe(
      (position: Geoposition) => {
        this.authorized = true;
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.errorString = undefined;
      },
      (error: Error) => {
        this.errorString = `${error.name}: ${error.message}`;
        this.latitude = undefined;
        this.longitude = undefined;
      }
    );
  }

  change() {
    this.geolocation.changeAuthorization().subscribe(
      (authorized: boolean) => {
        this.authorized = authorized;
      },
      (error: Error) => {
        this.errorString = `${error.name}: ${error.message}`;
      }
    );
  }

}
