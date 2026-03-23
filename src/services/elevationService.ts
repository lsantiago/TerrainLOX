/**
 * Servicio de Elevación usando DEM de SIGTIERRAS Ecuador (3m resolución)
 * Via Ellipsis Drive API
 */

// Configuración de Ellipsis Drive para DEM SIGTIERRAS
const ELLIPSIS_PATH_ID = 'cde9bf4d-db6e-4b51-8552-f3f1e8aec814'
const ELLIPSIS_TIMESTAMP_ID = 'aca4b11c-c9d4-49c8-b71f-e26c71f2c4e3'
const ELLIPSIS_API_BASE = 'https://api.ellipsis-drive.com/v3'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

interface EllipsisResponse {
  [index: number]: [number] | [null] // Cada resultado es un array con la elevación o null
}

/**
 * Obtiene elevaciones desde Ellipsis Drive para un conjunto de coordenadas
 * @param coordinates Array de coordenadas [lng, lat]
 * @returns Array de elevaciones en metros (puede contener null para puntos fuera de cobertura)
 */
export async function getElevationsFromEllipsis(
  coordinates: number[][] | [number, number][]
): Promise<(number | null)[]> {
  if (!coordinates || coordinates.length === 0) {
    throw new Error('No se proporcionaron coordenadas')
  }

  const url = `${ELLIPSIS_API_BASE}/path/${ELLIPSIS_PATH_ID}/raster/timestamp/${ELLIPSIS_TIMESTAMP_ID}/location`

  // Convertir coordenadas a formato de Ellipsis: [[lng,lat], [lng,lat], ...]
  const locationsParam = JSON.stringify(coordinates)

  let lastError: Error | null = null

  // Retry logic
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${url}?locations=${encodeURIComponent(locationsParam)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Ellipsis API error: ${response.status} ${response.statusText}`)
      }

      const data: EllipsisResponse = await response.json()

      // Validar respuesta
      if (!Array.isArray(data)) {
        throw new Error('Respuesta de Ellipsis con formato inválido')
      }

      if (data.length !== coordinates.length) {
        console.warn(
          `Ellipsis devolvió ${data.length} resultados para ${coordinates.length} coordenadas`
        )
      }

      // Extraer elevaciones (primera banda del raster)
      const elevations = data.map((result) => {
        if (!result || result.length === 0) return null
        const elevation = result[0]
        return elevation !== null && !isNaN(elevation) ? elevation : null
      })

      return elevations

    } catch (error) {
      lastError = error as Error

      // Si no es el último intento, esperar antes de reintentar
      if (attempt < MAX_RETRIES) {
        console.warn(
          `Intento ${attempt + 1}/${MAX_RETRIES + 1} falló, reintentando en ${RETRY_DELAY_MS}ms...`,
          error
        )
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw new Error(
    `No se pudieron obtener datos de elevación después de ${MAX_RETRIES + 1} intentos: ${lastError?.message}`
  )
}

/**
 * Filtra elevaciones nulas e interpola valores faltantes usando vecinos
 * Útil para el perfil de elevación cuando algunos puntos fallan
 */
export function interpolateNullElevations(elevations: (number | null)[]): number[] {
  const result = [...elevations]

  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      // Buscar vecino anterior válido
      let prev: number | null = null
      for (let j = i - 1; j >= 0; j--) {
        if (result[j] !== null) {
          prev = result[j]
          break
        }
      }

      // Buscar vecino siguiente válido
      let next: number | null = null
      for (let j = i + 1; j < result.length; j++) {
        if (result[j] !== null) {
          next = result[j]
          break
        }
      }

      // Interpolar
      if (prev !== null && next !== null) {
        result[i] = (prev + next) / 2
      } else if (prev !== null) {
        result[i] = prev
      } else if (next !== null) {
        result[i] = next
      } else {
        // Si no hay ningún valor válido, usar 0 como fallback
        result[i] = 0
      }
    }
  }

  return result as number[]
}
