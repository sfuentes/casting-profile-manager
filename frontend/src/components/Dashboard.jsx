import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import {Calendar, Check, Clock, Cloud} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Card, Badge} from './ui';

/**
 * Responsive columns without pulling in Grid.
 *
 * `display: grid` with a breakpoint object does what the Tailwind
 * `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` did, and it is one prop rather
 * than a Grid container plus an item wrapper per child.
 */
const columns = (breakpoints) => ({
    display: 'grid',
    gap: 3,
    gridTemplateColumns: Object.fromEntries(
        Object.entries(breakpoints).map(([at, count]) => [at, `repeat(${count}, minmax(0, 1fr))`])
    )
});

const Dashboard = () => {
    const {bookings, options, platforms, loading} = useAppContext();

    if (loading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256}}>
                <CircularProgress size={48}/>
            </Box>
        );
    }

    const connectedPlatforms = platforms.filter(p => p.connected).length;
    const upcomingBookings = bookings.filter(b => new Date(b.startDate) > new Date()).length;
    const activeOptions = options.filter(o => o.status === 'pending').length;

    const stats = [
        {title: 'Anstehende Buchungen', value: upcomingBookings, icon: Calendar, color: 'primary.main'},
        {title: 'Offene Optionen', value: activeOptions, icon: Clock, color: 'warning.main'},
        {
            title: 'Verbundene Plattformen',
            value: `${connectedPlatforms}/${platforms.length}`,
            icon: Cloud,
            color: 'success.main'
        },
        {title: 'Profil-Status', value: 'Aktuell', icon: Check, color: 'success.main'}
    ];

    return (
        <Stack gap={3}>
            <Typography variant="h4" component="h1" fontWeight={700}>Dashboard</Typography>

            <Box sx={columns({xs: 1, md: 2, lg: 4})}>
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                            <Box>
                                <Typography variant="body2" color="text.secondary" mb={0.5}>
                                    {stat.title}
                                </Typography>
                                <Typography variant="h5" fontWeight={700}>{stat.value}</Typography>
                            </Box>
                            <Box sx={{color: stat.color, display: 'flex'}}>
                                <stat.icon size={32}/>
                            </Box>
                        </Stack>
                    </Card>
                ))}
            </Box>

            <Box sx={columns({xs: 1, lg: 3})}>
                <Box sx={{gridColumn: {lg: 'span 2'}}}>
                    <Card>
                        <Typography variant="h6" mb={2}>Nächste Termine</Typography>
                        <Stack gap={1.5}>
                            {bookings.slice(0, 3).map((booking) => (
                                <Stack
                                    key={booking.id}
                                    direction="row"
                                    sx={{alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'grey.50', borderRadius: 2}}
                                >
                                    <Box>
                                        <Typography fontWeight={500}>{booking.title}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {new Date(booking.startDate).toLocaleDateString('de-DE')} - {booking.type}
                                        </Typography>
                                    </Box>
                                    <Badge color={booking.status === 'confirmed' ? 'green' : 'yellow'}>
                                        {booking.status === 'confirmed' ? 'Bestätigt' : 'Offen'}
                                    </Badge>
                                </Stack>
                            ))}
                        </Stack>
                    </Card>
                </Box>

                <Box>
                    <Card>
                        <Typography variant="h6" mb={2}>Plattform-Status</Typography>
                        <Stack gap={1.5}>
                            {platforms.map((platform) => (
                                <Stack
                                    key={platform.id}
                                    direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                    <Box>
                                        <Typography variant="body2" fontWeight={500}>{platform.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {platform.connected
                                                ? `Sync: ${new Date(platform.lastSync).toLocaleDateString('de-DE')}`
                                                : 'Nicht verbunden'}
                                        </Typography>
                                    </Box>
                                    <Badge color={platform.connected ? 'green' : 'gray'}>
                                        {platform.connected ? 'Aktiv' : 'Inaktiv'}
                                    </Badge>
                                </Stack>
                            ))}
                        </Stack>
                    </Card>
                </Box>
            </Box>
        </Stack>
    );
};

export default Dashboard;
