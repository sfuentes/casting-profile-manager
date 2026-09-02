import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, Input, Button } from './ui';
import { User, AlertCircle, Loader, CheckCircle } from 'lucide-react';

const Register = ({ onSwitchToLogin }) => {
    const { register, loading, error } = useAppContext();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [registered, setRegistered] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');

        if (password !== confirmPassword) {
            setLocalError('Passwörter stimmen nicht überein.');
            return;
        }

        try {
            await register({ name, email, password, confirmPassword });
            setRegistered(true);
        } catch (err) {
            setLocalError(err.message || 'Registrierung fehlgeschlagen.');
        }
    };

    if (registered) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <Card className="max-w-md w-full space-y-8 p-8 text-center">
                    <div className="flex justify-center">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Registrierung erfolgreich!</h2>
                    <p className="text-gray-600">
                        Ihr Konto wurde erstellt. Bitte überprüfen Sie Ihre E-Mails, um Ihr Konto zu verifizieren (in dieser Demo können Sie sich direkt anmelden).
                    </p>
                    <Button
                        onClick={onSwitchToLogin}
                        className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Zum Login
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="max-w-md w-full space-y-8 p-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Konto erstellen
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Oder{' '}
                        <button
                            onClick={onSwitchToLogin}
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            melden Sie sich mit Ihrem bestehenden Konto an
                        </button>
                    </p>
                </div>

                {(error || localError) && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">
                                    {localError || error}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <Input
                            label="Vollständiger Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <Input
                            label="E-Mail-Adresse"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Input
                            label="Passwort"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            hint="Muss enthalten: Großbuchstabe, Kleinbuchstabe, Zahl und Sonderzeichen"
                        />
                        <Input
                            label="Passwort bestätigen"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                        icon={loading ? Loader : User}
                    >
                        Registrieren
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default Register;
