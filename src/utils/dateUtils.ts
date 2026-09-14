/**
 * Utilidades para manejo y formateo de fechas
 * Formato estándar venezolano / latinoamericano: DD/MM/YYYY
 */

export const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  
  // Si ya viene formateado como DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
  
  // Si viene en formato ISO YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss...
  const clean = dateStr.split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // Fallback con objeto Date evitando desfase UTC si es posible
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // Si falla la conversión, retorna el string original
  }

  return dateStr;
};

/**
 * Convierte un objeto Date o string a formato YYYY-MM-DD compatible con <input type="date" />
 */
export const toInputDateFormat = (date: Date | string = new Date()): string => {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parts = date.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      // DD/MM/YYYY a YYYY-MM-DD
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    date = new Date(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha actual en la zona horaria local del usuario (YYYY-MM-DD),
 * evitando el desfase de UTC que genera toISOString() en horas de la noche.
 */
export const getTodayLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Suma días a una fecha (YYYY-MM-DD) respetando la zona horaria local
 */
export const addDaysToDate = (dateStr: string, days: number): string => {
  if (!dateStr) return getTodayLocalDate();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const target = new Date(y, m, d + days);
    return getTodayLocalDate(target);
  }
  const target = new Date(dateStr);
  target.setDate(target.getDate() + days);
  return getTodayLocalDate(target);
};
