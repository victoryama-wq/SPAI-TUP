import { Routes } from '@angular/router';
import { AssignmentsPageComponent } from './features/assignments/pages/assignments-page.component';
import { CyclesPageComponent } from './features/cycles/pages/cycles-page.component';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page.component';
import { GroupsPageComponent } from './features/groups/pages/groups-page.component';
import { NomenclaturesPageComponent } from './features/nomenclatures/pages/nomenclatures-page.component';
import { RequestsPageComponent } from './features/requests/pages/requests-page.component';
import { SubjectsPageComponent } from './features/subjects/pages/subjects-page.component';
import { TeachersPageComponent } from './features/teachers/pages/teachers-page.component';
import { UsersPageComponent } from './features/users/pages/users-page.component';
import { PlaceholderPageComponent } from './shared/components/placeholder-page/placeholder-page.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardPageComponent,
    title: 'Dashboard | SPAI TUP',
  },
  {
    path: 'ciclos',
    component: CyclesPageComponent,
    title: 'Ciclos | SPAI TUP',
  },
  {
    path: 'usuarios',
    component: UsersPageComponent,
    title: 'Usuarios y roles | SPAI TUP',
  },
  {
    path: 'nomenclaturas',
    component: NomenclaturesPageComponent,
    title: 'Nomenclaturas | SPAI TUP',
  },
  {
    path: 'grupos',
    component: GroupsPageComponent,
    title: 'Grupos | SPAI TUP',
  },
  {
    path: 'docentes',
    component: TeachersPageComponent,
    title: 'Docentes | SPAI TUP',
  },
  {
    path: 'asignaturas',
    component: SubjectsPageComponent,
    title: 'Asignaturas | SPAI TUP',
  },
  {
    path: 'asignaciones',
    component: AssignmentsPageComponent,
    title: 'Asignaciones | SPAI TUP',
  },
  {
    path: 'solicitudes',
    component: RequestsPageComponent,
    title: 'Solicitudes | SPAI TUP',
  },
  {
    path: 'ligas-meet',
    component: PlaceholderPageComponent,
    title: 'Ligas Meet | SPAI TUP',
    data: { title: 'Ligas Meet', description: 'Control operativo de ligas Meet para asignaciones virtuales.' },
  },
  {
    path: 'moodle',
    component: PlaceholderPageComponent,
    title: 'Moodle | SPAI TUP',
    data: { title: 'Moodle', description: 'Previsualizacion y exportacion futura de CSV para Moodle.' },
  },
  {
    path: 'bitacora',
    component: PlaceholderPageComponent,
    title: 'Bitacora | SPAI TUP',
    data: { title: 'Bitacora del sistema', description: 'Registro de acciones, cambios operativos y auditoria de modulos.' },
  },
  {
    path: '**',
    redirectTo: '',
  },
];
