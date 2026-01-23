import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, Input, Button } from './ui';
import { Mail, Lock, User, AlertCircle, Loader, CheckCircle } from 'lucide-react';

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
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label htmlFor="name" className="sr-only">Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pl-10"
                                    placeholder="Vollständiger Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="email-address" className="sr-only">E-Mail-Adresse</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pl-10"
                                    placeholder="E-Mail-Adresse"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Passwort</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pl-10"
                                    placeholder="Passwort (mind. 8 Zeichen)"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                Muss enthalten: Großbuchstabe, Kleinbuchstabe, Zahl und Sonderzeichen
                            </p>
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className="sr-only">Passwort bestätigen</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pl-10"
                                    placeholder="Passwort bestätigen"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <Button
                            type="submit"
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader className="animate-spin h-5 w-5 mr-2" />
                            ) : (
                                <User className="h-5 w-5 mr-2" />
                            )}
                            Registrieren
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default Register;
