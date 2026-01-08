import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert, Modal, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Edit2, Trash2, X, Clock, ChevronRight, ChevronDown } from 'lucide-react-native';
import { getContexts, createContext, updateContext, deleteContext, getSessions, extractContextsFromMessages } from '../services/api';
import ContextGraph from '../components/ContextGraph';

export default function VaultScreen() {
    const [activeTab, setActiveTab] = useState('contexts'); // 'contexts' or 'history'
    const [contexts, setContexts] = useState([]);
    const [sessions, setSessions] = useState([]);  // Changed from conversations
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingContext, setEditingContext] = useState(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState('active');

    // Reload data whenever screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            console.log('[VaultScreen] Screen focused - loading data');
            loadData();
        }, [activeTab])
    );

    const loadData = async () => {
        if (activeTab === 'contexts') {
            await loadContexts();
        } else {
            await loadSessions();  // Changed from loadConversations
        }
    };

    const loadContexts = async () => {
        try {
            // First, try to extract contexts from current conversation
            try {
                const messagesJson = await AsyncStorage.getItem('currentSessionMessages');
                if (messagesJson) {
                    const messages = JSON.parse(messagesJson);
                    if (messages.length > 0) {
                        console.log(`[Vault] Auto-extracting contexts from ${messages.length} messages...`);
                        await extractContextsFromMessages(messages);
                    }
                }
            } catch (extractError) {
                console.error('[Vault] Context extraction failed:', extractError);
                // Continue loading even if extraction fails
            }

            // Load all contexts (including newly extracted ones)
            const data = await getContexts();
            setContexts(data.contexts || []);
        } catch (error) {
            console.error('Failed to load contexts:', error);
            Alert.alert('Error', 'Failed to load contexts');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadSessions = async () => {
        try {
            const data = await getSessions();  // Changed from getConversations
            setSessions(data.sessions || []);  // Changed from setConversations
        } catch (error) {
            console.error('Failed to load sessions:', error);
            Alert.alert('Error', 'Failed to load conversation sessions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Title is required');
            return;
        }

        try {
            if (editingContext) {
                // Update existing
                await updateContext(editingContext.id, {
                    title,
                    description,
                    priority,
                    status
                });
            } else {
                // Create new
                await createContext({
                    title,
                    description,
                    priority,
                    status,
                    tags: []
                });
            }

            closeModal();
            loadContexts();
        } catch (error) {
            console.error('Failed to save context:', error);
            Alert.alert('Error', 'Failed to save context');
        }
    };

    const handleDelete = (contextId, contextTitle) => {
        Alert.alert(
            'Delete Context',
            `Are you sure you want to delete "${contextTitle}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteContext(contextId);
                            loadContexts();
                        } catch (error) {
                            console.error('Failed to delete:', error);
                            Alert.alert('Error', 'Failed to delete context');
                        }
                    }
                }
            ]
        );
    };

    const openModal = (context = null) => {
        if (context) {
            // Edit mode
            setEditingContext(context);
            setTitle(context.title);
            setDescription(context.description || '');
            setPriority(context.priority);
            setStatus(context.status);
        } else {
            // Add mode
            setEditingContext(null);
            setTitle('');
            setDescription('');
            setPriority('medium');
            setStatus('active');
        }
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingContext(null);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getStatusLabel = (status) => {
        return status.replace('_', ' ').split(' ').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
    };

    const renderContext = ({ item }) => (
        <LinearGradient
            colors={['rgba(148, 163, 253, 0.45)', 'rgba(56, 189, 248, 0.25)', 'rgba(15, 23, 42, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.contextCardOuter}
        >
            <View style={styles.contextCardInner}>
                <View style={styles.contextHeader}>
                <View style={styles.contextTitleRow}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                    <Text style={styles.contextTitle}>{item.title}</Text>
                </View>
                <View style={styles.contextActions}>
                    <TouchableOpacity onPress={() => openModal(item)} style={styles.actionButton}>
                        <Edit2 size={18} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id, item.title)} style={styles.actionButton}>
                        <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
                </View>

                {item.description ? (
                    <Text style={styles.contextDescription}>{item.description}</Text>
                ) : null}

                <View style={styles.contextFooter}>
                    <View style={[styles.statusBadge, { borderColor: getPriorityColor(item.priority) }]}>
                        <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                    </View>
                </View>
            </View>
        </LinearGradient>
    );

    const toggleSession = (sessionId) => {
        setExpandedSessions(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) {
                next.delete(sessionId);
            } else {
                next.add(sessionId);
            }
            return next;
        });
    };

    const renderSession = ({ item }) => {
        const sessionDate = new Date(item.timestamp);
        const dateStr = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isExpanded = expandedSessions.has(item.id);

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleSession(item.id)}
                style={styles.sessionCard}
            >
                <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitleRow}>
                        <Clock size={16} color="#a855f7" style={{ marginRight: 8 }} />
                        <Text style={styles.sessionTitle}>{item.title}</Text>
                    </View>
                    {isExpanded ?
                        <ChevronDown size={20} color="rgba(255,255,255,0.4)" /> :
                        <ChevronRight size={20} color="rgba(255,255,255,0.4)" />
                    }
                </View>

                {/* Tags Section */}
                {item.tags && item.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {item.tags.map((tag, index) => (
                            <View key={index} style={styles.tagBadge}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.sessionFooter}>
                    <View style={[styles.statusBadge, {
                        borderColor: getPriorityColor(item.priority || 'low'),
                        marginRight: 10
                    }]}>
                        <Text style={styles.statusText}>
                            {(item.priority || 'low').charAt(0).toUpperCase() + (item.priority || 'low').slice(1)} Priority
                        </Text>
                    </View>
                    <Text style={styles.sessionMeta}>
                        {dateStr} • {item.messageCount} msgs
                    </Text>
                </View>

                {/* Expanded Messages */}
                {isExpanded && item.messages && (
                    <View style={{ marginTop: 16 }}>
                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />
                        {item.messages.map((msg, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.messageCard,
                                    msg.role === 'user' ? styles.messageCardUser : {}
                                ]}
                            >
                                <View style={styles.messageHeader}>
                                    <Text style={styles.messageSender}>
                                        {msg.role === 'user' ? 'You' : 'Sneh'}
                                    </Text>
                                    <Text style={styles.messageTime}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <Text style={styles.messageContent}>{msg.content}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
                {activeTab === 'contexts' ? 'No Contexts Yet' : 'No Conversations Yet'}
            </Text>
            <Text style={styles.emptyText}>
                {activeTab === 'contexts'
                    ? 'Start building your personal knowledge base by adding contexts like goals, relationships, or concerns.'
                    : 'Your conversation history will appear here once you start chatting with Sneh.'}
            </Text>
            {activeTab === 'contexts' && (
                <TouchableOpacity style={styles.emptyButton} onPress={() => openModal()}>
                    <Text style={styles.emptyButtonText}>Add First Context</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <LinearGradient
            colors={['#0f172a', '#1e293b', '#334155']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            {/* Header with centered title */}
            <View style={styles.topBar}>
                <Text style={styles.headerTitle}>The Vault</Text>
                <Text style={styles.headerSubtitle}>Where your conversations turn into insights</Text>
            </View>

            {/* Context Knowledge Graph */}
            <View style={styles.networkContainer}>
                <ContextGraph contexts={contexts} />
            </View>

            {/* Section header + tabs */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    {activeTab === 'contexts' ? 'Active Contexts' : 'Conversation History'}
                </Text>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'contexts' && styles.tabActive]}
                        onPress={() => setActiveTab('contexts')}
                    >
                        <Text style={[styles.tabText, activeTab === 'contexts' && styles.tabTextActive]}>
                            Contexts
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                        onPress={() => setActiveTab('history')}
                    >
                        <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                            History
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            {activeTab === 'contexts' ? (
                <FlatList
                    data={contexts}
                    renderItem={renderContext}
                    keyExtractor={(item, index) => item.id || `context-${index}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={loadContexts} tintColor="#a855f7" />
                    }
                    ListEmptyComponent={!loading && renderEmpty()}
                />
            ) : (
                <FlatList
                    data={sessions}
                    renderItem={renderSession}
                    keyExtractor={(item, index) => item.id || `session-${index}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={loadSessions} tintColor="#a855f7" />
                    }
                    ListEmptyComponent={!loading && renderEmpty()}
                />
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
                <Plus size={28} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingContext ? 'Edit Context' : 'New Context'}
                            </Text>
                            <TouchableOpacity onPress={closeModal}>
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Title *"
                            placeholderTextColor="#6b7280"
                            value={title}
                            onChangeText={setTitle}
                        />

                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Description (optional)"
                            placeholderTextColor="#6b7280"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Priority Selector */}
                        <Text style={styles.label}>Priority</Text>
                        <View style={styles.buttonGroup}>
                            {['high', 'medium', 'low'].map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.optionButton,
                                        priority === p && { backgroundColor: getPriorityColor(p) }
                                    ]}
                                    onPress={() => setPriority(p)}
                                >
                                    <Text style={[styles.optionText, priority === p && styles.optionTextActive]}>
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Status Selector */}
                        <Text style={styles.label}>Status</Text>
                        <View style={styles.buttonGroup}>
                            {['active', 'stable', 'in_progress'].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[
                                        styles.optionButton,
                                        status === s && styles.optionButtonActive
                                    ]}
                                    onPress={() => setStatus(s)}
                                >
                                    <Text style={[styles.optionText, status === s && styles.optionTextActive]}>
                                        {getStatusLabel(s)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>
                                {editingContext ? 'Update' : 'Create'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 18,
    },
    networkContainer: {
        height: 320,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        paddingTop: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    headerSubtitle: {
        marginTop: 6,
        fontSize: 13,
        color: 'rgba(148,163,184,0.9)',
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
        flexGrow: 1,
    },
    contextCardOuter: {
        borderRadius: 18,
        padding: 1.5,
        marginBottom: 16,
    },
    contextCardInner: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.35)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 8,
    },
    contextHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    contextTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    priorityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    contextTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    contextActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 4,
    },
    contextDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 12,
        lineHeight: 20,
    },
    contextFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#a855f7',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 60,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    emptyButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        backgroundColor: '#a855f7',
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 8,
        marginTop: 8,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    optionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    optionButtonActive: {
        backgroundColor: '#a855f7',
        borderColor: '#a855f7',
    },
    optionText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    optionTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#a855f7',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    tabContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabActive: {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: '#a855f7',
    },
    tabText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#a855f7',
        fontWeight: '600',
    },
    messageCard: {
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#a855f7',
    },
    messageCardUser: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderLeftColor: '#3b82f6',
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    messageSender: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    messageTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    messageContent: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 20,
    },
    sessionCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sessionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sessionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    sessionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8, // Added margin
    },
    sessionMeta: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginLeft: 'auto', // Push to right
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
        marginLeft: 24, // Align with title
    },
    tagBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
    },
});
