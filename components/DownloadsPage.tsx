import React, { useMemo, useState } from 'react'
import { ArrowLeft, X, Pause, Play, CheckCircle2, FileText, Search, Download as DownloadIcon, Activity, AlertCircle, Clock, Trash2, List } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TransferTask } from './TransferManager'
import { formatBytesOrDash, formatEtaSeconds, formatSpeed } from '../utils'
import { ActionIcon, Badge, Box, Button, Card, Group, Paper, Progress, ScrollArea, Stack, Tabs, Text, TextInput, ThemeIcon, Title } from '@mantine/core'

interface DownloadsPageProps {
    tasks: TransferTask[]
    onCancel: (id: string) => void
    onCancelAll: () => void
    onClearCompleted: () => void
    onPause: (id: string) => void
    onResume: (id: string) => void
    onClose: () => void
}

export const DownloadsPage: React.FC<DownloadsPageProps> = ({
    tasks,
    onCancel,
    onCancelAll,
    onClearCompleted,
    onPause,
    onResume,
    onClose,
}) => {

    const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'errors'>('all')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const selectedTask = useMemo(() => {
        if (!selectedId) return null
        return tasks.find(t => t.id === selectedId) || null
    }, [tasks, selectedId])

    const stats = useMemo(() => {
        const active = tasks.filter(t => t.status === 'downloading' || t.status === 'ready' || t.status === 'paused')
        const completed = tasks.filter(t => t.status === 'completed')
        const errors = tasks.filter(t => t.status === 'error')
        const totalBytes = tasks.reduce((acc, t) => acc + (t.status === 'downloading' ? t.bytesDownloaded : 0), 0)
        const avgSpeed = active.length > 0 ? active.reduce((acc, t) => acc + (t.speed || 0), 0) / active.length : 0
        return { active, completed, errors, totalBytes, avgSpeed }
    }, [tasks])

    const filteredTasks = useMemo(() => {
        let list = tasks
        if (filter === 'active') list = stats.active
        else if (filter === 'completed') list = stats.completed
        else if (filter === 'errors') list = stats.errors

        const q = searchQuery.trim().toLowerCase()
        if (q) list = list.filter(t => t.name.toLowerCase().includes(q))
        return list
    }, [tasks, filter, stats, searchQuery])

    const eta = useMemo(() => {
        if (!selectedTask) return '--:--'
        if (selectedTask.status !== 'downloading' || !selectedTask.speed) return '--:--'
        const remaining = Math.max(0, selectedTask.size - selectedTask.bytesDownloaded)
        const seconds = Math.floor(remaining / selectedTask.speed)
        return formatEtaSeconds(seconds)
    }, [selectedTask])

    const statusConfig = (task: TransferTask) => {
        if (task.status === 'completed') return { color: 'emerald', icon: CheckCircle2, label: 'COMPLETED' }
        if (task.status === 'error') return { color: 'red', icon: AlertCircle, label: 'FAILED' }
        if (task.status === 'paused') return { color: 'amber', icon: Pause, label: 'PAUSED' }
        if (task.status === 'ready') return { color: 'slate', icon: Clock, label: 'QUEUED' }
        return { color: 'blue', icon: Activity, label: 'DOWNLOADING' }
    }

    return (
        <Box className="h-full min-h-0 flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8 font-sans" bg="gray.0">
            {/* Header */}
            <Paper withBorder radius="xl" px="md" py="sm" bg="white">
                <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            radius="lg"
                            onClick={onClose}
                            size="md"
                            aria-label="Back"
                            title="Back"
                        >
                            <ArrowLeft size={18} aria-hidden="true" />
                        </ActionIcon>
                        <Box style={{ minWidth: 0 }}>
                            <Text fw={800} size="sm">
                                Transfers
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                                {stats.active.length} active / {stats.completed.length} done
                            </Text>
                        </Box>
                    </Group>

                    <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Paper
                            withBorder
                            radius="xl"
                            px="sm"
                            py={4}
                            bg="var(--mantine-color-green-0)"
                            style={{ borderColor: 'var(--mantine-color-green-2)' }}
                            className="hidden sm:block"
                        >
                            <Group gap={6} wrap="nowrap">
                                <Box w={6} h={6} style={{ borderRadius: 999, background: 'var(--mantine-color-green-6)' }} />
                                <Text size="xs" fw={700} c="var(--mantine-color-green-9)" tt="uppercase" style={{ letterSpacing: 1.1 }}>
                                    System Operational
                                </Text>
                            </Group>
                        </Paper>
                        <Button
                            variant="white"
                            radius="lg"
                            size="sm"
                            leftSection={<CheckCircle2 size={16} />}
                            disabled={stats.completed.length === 0}
                            onClick={onClearCompleted}
                            className="shadow-sm font-semibold"
                        >
                            Clear
                        </Button>
                        <Button
                            variant="filled"
                            color="red"
                            radius="lg"
                            size="sm"
                            leftSection={<Trash2 size={16} />}
                            disabled={tasks.length === 0}
                            onClick={onCancelAll}
                            className="font-semibold"
                        >
                            Cancel
                        </Button>
                    </Group>
                </Group>
            </Paper>

            <div className="flex-1 min-h-0 mt-4">
                <div className={`grid grid-cols-1 gap-6 items-start h-full min-h-0 ${selectedTask ? 'lg:grid-cols-12' : ''}`}>
                    {/* Main List Area */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <Tabs
                                value={filter}
                                onChange={(val) => setFilter(val as any)}
                                variant="pills"
                                radius="lg"
                                styles={{
                                    tab: { fontWeight: 700, fontSize: 13, padding: '8px 16px' },
                                }}
                            >
                                <Tabs.List>
                                    <Tabs.Tab value="all">Database ({tasks.length})</Tabs.Tab>
                                    <Tabs.Tab value="active">Live Streams</Tabs.Tab>
                                    <Tabs.Tab value="completed">Archive</Tabs.Tab>
                                    <Tabs.Tab value="errors">Alerts</Tabs.Tab>
                                </Tabs.List>
                            </Tabs>

                            <TextInput
                                placeholder="Locate file in queue..."
                                size="md"
                                radius="lg"
                                leftSection={<Search size={18} style={{ color: 'var(--mantine-color-gray-4)', marginLeft: 8 }} />}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                w={{ base: '100%', sm: 260 }}
                                className="shadow-sm"
                            />
                        </div>

                        <Card padding={0} radius="xl" withBorder bg="white" className="flex-1 min-h-0 overflow-hidden">
                            <ScrollArea h="100%" offsetScrollbars className="h-full">
                                <div className="divide-y divide-slate-50">
                                    <AnimatePresence mode="popLayout">
                                        {filteredTasks.length === 0 ? (
                                            <div className="py-24 text-center">
                                                <ThemeIcon size={64} radius="xl" color="slate.50" mb={16} mx="auto">
                                                    <DownloadIcon size={32} className="text-slate-200" />
                                                </ThemeIcon>
                                                <Text size="sm" fw={700} c="slate.400">No matching transfers detected.</Text>
                                            </div>
                                        ) : (
                                            filteredTasks.map((task) => {
                                                const selected = selectedId === task.id
                                                const config = statusConfig(task)
                                                const showSpeed = task.status === 'downloading' && (task.speed || 0) > 0
                                                const remaining = Math.max(0, (task.size || 0) - (task.bytesDownloaded || 0))
                                                const etaLocal = showSpeed ? formatEtaSeconds(Math.floor(remaining / (task.speed || 1))) : '--:--'
                                                return (
                                                    <motion.div
                                                        key={task.id}
                                                        layout
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        className={`p-5 transition-all cursor-pointer group hover:bg-slate-50/50 ${selected ? 'bg-slate-100/60' : ''}`}
                                                        onClick={() => setSelectedId(task.id)}
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200 ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' :
                                                                task.status === 'error' ? 'bg-red-50 text-red-500' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                <FileText size={24} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <Text fw={800} size="sm" className="text-slate-900 group-hover:text-slate-900 truncate transition-colors">
                                                                    {task.name}
                                                                </Text>
                                                                <Group gap={12} mt={4}>
                                                                    <Badge size="xs" radius="xs" color={config.color} variant="filled" className="font-black text-[8px] tracking-tight">{config.label}</Badge>
                                                                    <Text size="xs" fw={700} c="slate.400">{formatBytesOrDash(task.size)}</Text>
                                                                    {showSpeed && (
                                                                        <Text size="xs" fw={700} c="slate.400">{formatSpeed(task.speed)} • {etaLocal}</Text>
                                                                    )}
                                                                </Group>
                                                            </div>
                                                            <div className="text-right hidden sm:block w-32">
                                                                <Text size="xs" fw={900} className="text-slate-900">{Math.round(task.progress)}%</Text>
                                                                <Progress
                                                                    value={task.progress}
                                                                    size="xs"
                                                                    radius="xl"
                                                                    color={config.color}
                                                                    animated={task.status === 'downloading'}
                                                                    mt={6}
                                                                />
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {task.status === 'downloading' && (
                                                                    <ActionIcon
                                                                        variant="subtle"
                                                                        color="slate"
                                                                        radius="xl"
                                                                        size="lg"
                                                                        onClick={(e) => { e.stopPropagation(); onPause(task.id); }}
                                                                        aria-label="Pause transfer"
                                                                        title="Pause"
                                                                    >
                                                                        <Pause size={18} aria-hidden="true" />
                                                                    </ActionIcon>
                                                                )}
                                                                {task.status === 'paused' && (
                                                                    <ActionIcon
                                                                        variant="subtle"
                                                                        color="blue"
                                                                        radius="xl"
                                                                        size="lg"
                                                                        onClick={(e) => { e.stopPropagation(); onResume(task.id); }}
                                                                        aria-label="Resume transfer"
                                                                        title="Resume"
                                                                    >
                                                                        <Play size={18} aria-hidden="true" />
                                                                    </ActionIcon>
                                                                )}
                                                                <ActionIcon
                                                                    variant="subtle"
                                                                    color="red"
                                                                    radius="xl"
                                                                    size="lg"
                                                                    onClick={(e) => { e.stopPropagation(); onCancel(task.id); }}
                                                                    aria-label="Cancel transfer"
                                                                    title="Cancel"
                                                                >
                                                                    <Trash2 size={18} aria-hidden="true" />
                                                                </ActionIcon>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )
                                            })
                                        )}
                                    </AnimatePresence>
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>

                    {/* Inspector Area */}
                    <div className="lg:col-span-4 sticky top-12">
                        <AnimatePresence mode="wait">
                            {selectedTask ? (
                                <motion.div
                                    key={selectedTask.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Paper withBorder radius="24px" p={28} className="bg-white shadow-xl shadow-slate-200/50">
                                        <Group justify="space-between" mb={24}>
                                            <div>
                                                <Text size="xs" fw={900} tt="uppercase" lts={1.5} c="slate.400" mb={4}>Live Inspector</Text>
                                                <Title order={4} className="leading-tight text-slate-900 group-hover:text-slate-900 line-clamp-2">{selectedTask.name}</Title>
                                            </div>
                                            <ActionIcon
                                                variant="subtle"
                                                color="slate"
                                                radius="xl"
                                                onClick={() => setSelectedId(null)}
                                                aria-label="Close inspector"
                                                title="Close"
                                            >
                                                <X size={20} aria-hidden="true" />
                                            </ActionIcon>
                                        </Group>

                                        <Stack gap={20}>
                                            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                                                <Group justify="space-between" mb={12}>
                                                    <Text size="xs" fw={800} c="slate.500">TRANSFER STATUS</Text>
                                                    <Badge size="sm" radius="sm" variant="outline" color={statusConfig(selectedTask).color} className="font-black">{selectedTask.status.toUpperCase()}</Badge>
                                                </Group>
                                                <Progress
                                                    value={selectedTask.progress}
                                                    size="xl"
                                                    radius="xl"
                                                    color={statusConfig(selectedTask).color}
                                                    animated={selectedTask.status === 'downloading'}
                                                />
                                                <Group justify="space-between" mt={10}>
                                                    <Text size="sm" fw={900}>{Math.round(selectedTask.progress)}%</Text>
                                                    <Text size="xs" fw={700} c="slate.400">{formatBytesOrDash(selectedTask.bytesDownloaded)} / {formatBytesOrDash(selectedTask.size)}</Text>
                                                </Group>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <Paper withBorder p={16} radius="xl" bg="slate.50/30">
                                                    <Text size="xs" fw={800} c="slate.400" mb={4} tt="uppercase" lts={1}>Current Speed</Text>
                                                    <Text fw={900} size="lg">{formatSpeed(selectedTask.speed)}</Text>
                                                </Paper>
                                                <Paper withBorder p={16} radius="xl" bg="slate.50/30">
                                                    <Text size="xs" fw={800} c="slate.400" mb={4} tt="uppercase" lts={1}>Final ETA</Text>
                                                    <Text fw={900} size="lg">{eta}</Text>
                                                </Paper>
                                            </div>

                                            {selectedTask.status === 'error' && (
                                                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                                                    <AlertCircle color="red" size={18} className="mt-0.5" />
                                                    <Text size="xs" fw={700} c="red.9">{selectedTask.errorMessage || 'Unknown protocol error occurred during transport.'}</Text>
                                                </div>
                                            )}

                                            <Group grow gap={12} mt={12}>
                                                {selectedTask.status === 'downloading' ? (
                                                    <Button variant="filled" color="amber" radius="xl" size="md" leftSection={<Pause size={18} />} onClick={() => onPause(selectedTask.id)}>Pause Stream</Button>
                                                ) : selectedTask.status === 'paused' ? (
                                                    <Button variant="filled" color="blue" radius="xl" size="md" leftSection={<Play size={18} />} onClick={() => onResume(selectedTask.id)}>Resume Stream</Button>
                                                ) : null}
                                                <Button variant="light" color="red" radius="xl" size="md" leftSection={<Trash2 size={18} />} onClick={() => onCancel(selectedTask.id)}>Remove</Button>
                                            </Group>
                                        </Stack>
                                    </Paper>
                                </motion.div>
                            ) : (
                                <Paper withBorder radius="24px" p={40} className="text-center bg-white border-dashed">
                                    <ThemeIcon size={64} radius="xl" color="slate.50" mb={20} mx="auto">
                                        <List size={32} className="text-slate-300" />
                                    </ThemeIcon>
                                    <Title order={5} mb={8}>Inspector Dormant</Title>
                                    <Text size="xs" c="slate.400" fw={600}>Select an active or historical transfer to view deep-packet details and metrics.</Text>
                                </Paper>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </Box>
    )
}
