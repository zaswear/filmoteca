/**
 * Butaca de sala como icono de estado: vacía (pendiente) u ocupada (vista).
 * Trazo fino al estilo de los iconos del proyecto (lucide), hereda
 * `currentColor`.
 */
interface SeatIconProps {
    occupied?: boolean;
    size?: number;
    className?: string;
}

export function SeatIcon({ occupied = false, size = 12, className }: SeatIconProps) {
    return (
        <svg
            aria-hidden="true"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Respaldo */}
            <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v9H7z" />
            {/* Asiento */}
            <path d="M4 13h16a1 1 0 0 1 1 1v3H3v-3a1 1 0 0 1 1-1z" />
            {/* Patas */}
            <path d="M6.5 17v3.5M17.5 17v3.5" />
            {occupied && (
                <>
                    {/* Espectador: cabeza y hombros, rellenos */}
                    <circle cx="12" cy="6" r="2" fill="currentColor" stroke="none" />
                    <path d="M8.8 11.4a3.2 3.2 0 0 1 6.4 0Z" fill="currentColor" stroke="none" />
                </>
            )}
        </svg>
    );
}
