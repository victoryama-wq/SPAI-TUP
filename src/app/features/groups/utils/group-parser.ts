import { GroupModality, GroupShift } from '../data/groups.repository';

export interface ParsedGroupCode {
  fullGroup: string;
  cycleCode: string;
  programAbbreviation: string;
  groupCode: string;
  section: string;
  modality: GroupModality;
  shift: GroupShift;
  observations: string[];
}

const GROUP_PATTERN = /^(\d{2}-\d)\s+([A-Z]+)\s+([A-Z0-9]+)\s+([A-Z0-9. ]+)$/;

export function parseAcademicGroup(rawGroup: string): ParsedGroupCode {
  const fullGroup = normalizeFullGroup(rawGroup);
  const match = fullGroup.match(GROUP_PATTERN);

  if (!match) {
    return {
      fullGroup,
      cycleCode: '',
      programAbbreviation: '',
      groupCode: '',
      section: '',
      modality: 'No identificada',
      shift: 'No identificado',
      observations: ['El grupo debe usar el formato 26-3 DER 53 01A o 27-1 CRIMYCRI 11 03 C.A.'],
    };
  }

  const [, cycleCode, programAbbreviation, groupCode, section] = match;
  // Los grupos EJE C.A. son cursos especiales: no llevan el código numérico habitual,
  // pero deben poder registrarse para que aparezcan en la pestaña Especiales.
  const isSpecialEjeGroup = groupCode === 'EJE' && section.trim().endsWith('C.A');
  const modality = isSpecialEjeGroup ? 'Escolarizado' : detectModality(groupCode.charAt(0));
  const shift = isSpecialEjeGroup ? 'No identificado' : detectShift(groupCode.charAt(1));
  const observations: string[] = [];

  if (!isSpecialEjeGroup && modality === 'No identificada') {
    observations.push(`No se reconoce la modalidad para el primer digito ${groupCode.charAt(0)}.`);
  }

  if (!isSpecialEjeGroup && shift === 'No identificado') {
    observations.push(`No se reconoce el turno para el segundo digito ${groupCode.charAt(1)}.`);
  }

  return {
    fullGroup,
    cycleCode,
    programAbbreviation,
    groupCode,
    section: section.trim(),
    modality,
    shift,
    observations,
  };
}

export function normalizeFullGroup(rawGroup: string): string {
  return rawGroup.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function resolveAcademicArea(
  programAbbreviation: string,
  catalogArea: string,
  nomenclatureNotes = '',
): string {
  const notesArea = resolveAreaFromText(nomenclatureNotes);

  if (notesArea) {
    return notesArea;
  }

  const normalizedCatalogArea = catalogArea.trim();

  if (normalizedCatalogArea && normalizedCatalogArea.toLowerCase() !== 'pendiente de clasificar') {
    return normalizedCatalogArea;
  }

  if (['ENF', 'NUT', 'PSIC', 'EECI', 'EEQX', 'MADH'].includes(programAbbreviation.toUpperCase())) {
    return 'Facultad de Ciencias de la Salud';
  }

  return 'Campus TUP';
}

function resolveAreaFromText(value: string): string {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalizedValue) {
    return '';
  }

  if (
    normalizedValue.includes('facultad de ciencias de la salud') ||
    normalizedValue.includes('facultad') ||
    normalizedValue.includes('salud')
  ) {
    return 'Facultad de Ciencias de la Salud';
  }

  if (normalizedValue.includes('campus tup') || normalizedValue.includes('campus')) {
    return 'Campus TUP';
  }

  return '';
}

function detectModality(firstDigit: string): GroupModality {
  if (firstDigit === '1' || firstDigit === '4') {
    return 'Escolarizado';
  }

  if (firstDigit === '2') {
    return 'Ejecutivo';
  }

  if (firstDigit === '5') {
    return 'Virtual';
  }

  return 'No identificada';
}

function detectShift(secondDigit: string): GroupShift {
  if (secondDigit === '1' || secondDigit === '3') {
    return 'Matutino';
  }

  if (secondDigit === '2' || secondDigit === '4') {
    return 'Vespertino';
  }

  if (secondDigit === '8') {
    return 'Nocturno';
  }

  return 'No identificado';
}
