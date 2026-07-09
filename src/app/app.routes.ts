import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/pages/dashboard-page.component')
      .then((module) => module.DashboardPageComponent),
    title: 'Dashboard | SPAI TUP',
  },
  {
    path: 'ciclos',
    loadComponent: () => import('./features/cycles/pages/cycles-page.component')
      .then((module) => module.CyclesPageComponent),
    title: 'Ciclos | SPAI TUP',
  },
  {
    path: 'usuarios',
    loadComponent: () => import('./features/users/pages/users-page.component')
      .then((module) => module.UsersPageComponent),
    title: 'Usuarios y roles | SPAI TUP',
  },
  {
    path: 'nomenclaturas',
    loadComponent: () => import('./features/nomenclatures/pages/nomenclatures-page.component')
      .then((module) => module.NomenclaturesPageComponent),
    title: 'Nomenclaturas | SPAI TUP',
  },
  {
    path: 'grupos',
    loadComponent: () => import('./features/groups/pages/groups-page.component')
      .then((module) => module.GroupsPageComponent),
    title: 'Grupos | SPAI TUP',
  },
  {
    path: 'docentes',
    loadComponent: () => import('./features/teachers/pages/teachers-page.component')
      .then((module) => module.TeachersPageComponent),
    title: 'Docentes | SPAI TUP',
  },
  {
    path: 'asignaturas',
    loadComponent: () => import('./features/subjects/pages/subjects-page.component')
      .then((module) => module.SubjectsPageComponent),
    title: 'Asignaturas | SPAI TUP',
  },
  {
    path: 'asignaciones',
    loadComponent: () => import('./features/assignments/pages/assignments-page.component')
      .then((module) => module.AssignmentsPageComponent),
    title: 'Asignaciones | SPAI TUP',
  },
  {
    path: 'solicitudes',
    loadComponent: () => import('./features/requests/pages/requests-page.component')
      .then((module) => module.RequestsPageComponent),
    title: 'Solicitudes | SPAI TUP',
  },
  {
    path: 'ligas-meet',
    loadComponent: () => import('./features/meet-links/pages/meet-links-page.component')
      .then((module) => module.MeetLinksPageComponent),
    title: 'Ligas Meet | SPAI TUP',
  },
  {
    path: 'moodle',
    loadComponent: () => import('./features/moodle/pages/moodle-page.component')
      .then((module) => module.MoodlePageComponent),
    title: 'Moodle | SPAI TUP',
  },
  {
    path: 'bitacora',
    loadComponent: () => import('./features/audit/pages/audit-log-page.component')
      .then((module) => module.AuditLogPageComponent),
    title: 'Bitacora | SPAI TUP',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
