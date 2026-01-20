interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function Switch({ checked, onChange, disabled = false, label, size = 'md' }: SwitchProps) {
    const sizeClasses = {
        sm: {
            track: 'w-8 h-4',
            thumb: 'w-3 h-3',
            translate: 'translate-x-4',
        },
        md: {
            track: 'w-11 h-6',
            thumb: 'w-5 h-5',
            translate: 'translate-x-5',
        },
        lg: {
            track: 'w-14 h-8',
            thumb: 'w-7 h-7',
            translate: 'translate-x-6',
        }
    };

    const currentSize = sizeClasses[size];

    return (
        <label className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => !disabled && onChange(e.target.checked)}
                    disabled={disabled}
                />
                <div className={`${currentSize.track} ${checked ? 'bg-blue-600' : 'bg-gray-300'} rounded-full shadow-inner transition-colors duration-300 ease-in-out`}></div>
                <div className={`absolute left-0.5 top-0.5 ${currentSize.thumb} bg-white rounded-full shadow transform transition-transform duration-300 ease-in-out ${checked ? currentSize.translate : 'translate-x-0'}`}></div>
            </div>
            {label && <span className="ml-3 text-sm font-medium text-gray-700">{label}</span>}
        </label>
    );
}
