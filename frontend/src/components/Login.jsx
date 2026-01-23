import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, Input, Button } from './ui';
import { Mail, Lock, AlertCircle, Loader } from 'lucide-react';

const Login = ({ onSwitchToRegister }) => {
    const { login, loading, error } = useAppContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        
        if (!email || !password) {
            setLocalError('Bitte geben Sie E-Mail und Passwort ein.');
            return;
        }

        try {
            await login(email, password);
        } catch (err) {
            setLocalError(err.message || 'Login fehlgeschlagen. Bitte überprüfen Sie Ihre Daten.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="max-w-md w-full space-y-8 p-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Anmelden
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Oder{' '}
                        <button
                            onClick={onSwitchToRegister}
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            erstellen Sie ein neues Konto
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
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pl-10"
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
                                    autoComplete="current-password"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pl-10"
                                    placeholder="Passwort"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                                <Lock className="h-5 w-5 mr-2" />
                            )}
                            Anmelden
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default Login;
