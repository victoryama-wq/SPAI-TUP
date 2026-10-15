import { Component } from '@angular/core';

@Component({
  selector: 'spai-access-restricted',
  imports: [],
  template: `<section role="status"><h2>Acceso restringido</h2><p>No tienes módulos autorizados. Solicita a Administración General que revise tus permisos.</p></section>`,
  styles: `section { padding:24px; background:#fff; border:1px solid #d7e4f8; border-radius:8px; } h2 { color:#06174a; }`,
})
export class AccessRestrictedComponent {

}
