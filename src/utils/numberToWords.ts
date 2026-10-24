/**
 * Convierte un número monetario a su representación en letras legal (Español formal)
 * Ejemplo: 180.00 -> "CIENTO OCHENTA CON 00/100 DÓLARES"
 */

const UNIDADES = [
  '',
  'UN',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];

const DECENAS = [
  '',
  'DIEZ',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function convertirGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  let resultado = '';
  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (c > 0) {
    resultado += CENTENAS[c] + ' ';
  }

  if (resto <= 29) {
    resultado += UNIDADES[resto];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    resultado += DECENAS[d];
    if (u > 0) {
      resultado += ' Y ' + UNIDADES[u];
    }
  }

  return resultado.trim();
}

export function numberToWordsSpanish(
  amount: number,
  currencyName: string = 'DÓLARES'
): string {
  if (amount == null || isNaN(amount)) return 'CERO CON 00/100 ' + currencyName;

  const absolute = Math.abs(amount);
  const entero = Math.floor(absolute);
  const centavos = Math.round((absolute - entero) * 100);
  const centavosStr = centavos.toString().padStart(2, '0');

  if (entero === 0) {
    return `CERO CON ${centavosStr}/100 ${currencyName}`;
  }

  let partes: string[] = [];

  // Millones
  const millones = Math.floor(entero / 1_000_000);
  const restoMillones = entero % 1_000_000;

  if (millones === 1) {
    partes.push('UN MILLÓN');
  } else if (millones > 1) {
    partes.push(convertirGrupo(millones) + ' MILLONES');
  }

  // Miles
  const miles = Math.floor(restoMillones / 1000);
  const unidades = restoMillones % 1000;

  if (miles === 1) {
    partes.push('MIL');
  } else if (miles > 1) {
    partes.push(convertirGrupo(miles) + ' MIL');
  }

  // Centenas/Decenas/Unidades
  if (unidades > 0) {
    partes.push(convertirGrupo(unidades));
  }

  const textoEntero = partes.join(' ').trim();
  return `${textoEntero} CON ${centavosStr}/100 ${currencyName}`;
}
