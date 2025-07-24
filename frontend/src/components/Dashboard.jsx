import React from 'react';
import {Calendar, Check, Clock, Cloud, Loader} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Card, Badge} from './ui';

const Dashboard = () => {
    const {bookings, options, platforms, loading} = useAppContext();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader size={48} className="animate-spin text-blue-600"/>
            </div>
        );
    }

    const connectedPlatforms = platforms.filter(p => p.connected).length;
    const upcomingBookings = bookings.filter(b => new Date(b.startDate) > new Date()).length;
    const activeOptions = options.filter(o => o.status === 'pending').length;

    const stats = [
        {title: 'Anstehende Buchungen', value: upcomingBookings, icon: Calendar, color: 'text-blue-600'},
        {title: 'Offene Optionen', value: activeOptions, icon: Clock, color: 'text-yellow-600'},
        {
            title: 'Verbundene Plattformen',
            value: `${connectedPlatforms}/${platforms.length}`,
            icon: Cloud,
            color: 'text-green-600'
        },
        {title: 'Profil-Status', value: 'Aktuell', icon: Check, color: 'text-green-600'}
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                            </div>
                            <stat.icon className={`w-8 h-8 ${stat.color}`}/>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <h2 className="text-lg font-semibold mb-4">Nächste Termine</h2>
                        <div className="space-y-3">
                            {bookings.slice(0, 3).map((booking) => (
                                <div key={booking.id}
                                     className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium">{booking.title}</p>
                                        <p className="text-sm text-gray-600">
                                            {new Date(booking.startDate).toLocaleDateString('de-DE')} - {booking.type}
                                        </p>
                                    </div>
                                    <Badge color={booking.status === 'confirmed' ? 'green' : 'yellow'}>
                                        {booking.status === 'confirmed' ? 'Bestätigt' : 'Offen'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div>
                    <Card>
                        <h2 className="text-lg font-semibold mb-4">Plattform-Status</h2>
                        <div className="space-y-3">
                            {platforms.map((platform) => (
                                <div key={platform.id} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-sm">{platform.name}</p>
                                        <p className="text-xs text-gray-600">
                                            {platform.connected ? `Sync: ${new Date(platform.lastSync).toLocaleDateString('de-DE')}` : 'Nicht verbunden'}
                                        </p>
                                    </div>
                                    <Badge color={platform.connected ? 'green' : 'gray'}>
                                        {platform.connected ? 'Aktiv' : 'Inaktiv'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;