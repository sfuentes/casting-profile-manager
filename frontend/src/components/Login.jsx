import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useAppContext } from '../context/AppContext';
import { Card, Input, Button } from './ui';
import { Lock, Loader } from 'lucide-react';

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
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.50',
                px: 2,
                py: 6
            }}
        >
            <Card sx={{ maxWidth: 440, width: '100%', p: 4 }}>
                <Stack gap={3}>
                    <Box sx={{textAlign: 'center'}}>
                        <Typography variant="h4" component="h2" fontWeight={800}>
                            Anmelden
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                            Oder{' '}
                            <Link component="button" type="button" onClick={onSwitchToRegister} fontWeight={500}>
                                erstellen Sie ein neues Konto
                            </Link>
                        </Typography>
                    </Box>

                    {(error || localError) && (
                        <Alert severity="error">{localError || error}</Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit}>
                        <Stack gap={2}>
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
                            />
                            <Button
                                type="submit"
                                fullWidth
                                disabled={loading}
                                icon={loading ? Loader : Lock}
                            >
                                Anmelden
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </Card>
        </Box>
    );
};

export default Login;
