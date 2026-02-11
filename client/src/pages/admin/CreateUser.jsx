import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { User, Mail, Lock, CheckCircle, ArrowRight, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    role: z.enum(['admin', 'project_manager', 'team_lead', 'member']),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

const CreateUser = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            role: 'member'
        }
    });

    const onSubmit = async (data) => {
        setIsLoading(true);
        setError('');
        try {
            await axios.post('/api/auth/register', {
                name: data.name,
                email: data.email,
                password: data.password,
                role: data.role
            });
            toast.success('User created successfully');
            navigate('/admin/users');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Create New User</h1>
                <p className="text-slate-500 mt-1">Add a new member to your organization.</p>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="John Doe"
                                    className="pl-10 h-11 border-slate-200 focus:ring-indigo-500"
                                    error={errors.name?.message}
                                    {...register('name')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="email@example.com"
                                    type="email"
                                    className="pl-10 h-11 border-slate-200 focus:ring-indigo-500"
                                    error={errors.email?.message}
                                    {...register('email')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Role</label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 h-11 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm appearance-none bg-white"
                                    {...register('role')}
                                >
                                    <option value="member">Member</option>
                                    <option value="team_lead">Team Lead</option>
                                    <option value="project_manager">Project Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            {errors.role && <p className="text-xs text-rose-500 mt-1">{errors.role.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="••••••••"
                                    type="password"
                                    className="pl-10 h-11 border-slate-200 focus:ring-indigo-500"
                                    error={errors.password?.message}
                                    {...register('password')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Confirm Password</label>
                            <div className="relative">
                                <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="••••••••"
                                    type="password"
                                    className="pl-10 h-11 border-slate-200 focus:ring-indigo-500"
                                    error={errors.confirmPassword?.message}
                                    {...register('confirmPassword')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate('/admin/users')}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="px-8 h-11 font-semibold"
                            isLoading={isLoading}
                        >
                            Create User
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUser;
