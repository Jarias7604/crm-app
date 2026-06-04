import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../services/supabase';
import { 
  Layers, Plus, Play, Square, Clock, AlertTriangle, CheckCircle, 
  Trash2, User, Calendar as CalendarIcon, MessageSquare, Tag, 
  ChevronRight, ArrowRight, Loader2, Sparkles, Filter, CheckCircle2,
  ListTodo, KanbanSquare, BarChart4, AlertCircle, X, Search,
  Check, TrendingUp, TrendingDown, ShieldCheck, ShieldX, Pencil, GripVertical
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  status: 'pending' | 'passed' | 'failed';
}

interface Task {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  assigned_to?: string | null;
  assigned_name?: string;
  assigned_avatar?: string;
  title: string;
  description: string;
  /** todo | in_progress | paused | pending_approval | rejected | completed */
  status: 'todo' | 'in_progress' | 'paused' | 'pending_approval' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_hours: number;
  actual_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  checklist?: TaskChecklistItem[];
  created_at: string;
  // Supervisor approval workflow
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  submitted_at?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

export default function ProjectManagement() {
  const { profile } = useAuth();
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  
  // Timer States
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<any>(null);

  // Filter States
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'timeline'>('list');
  const [ganttWeekOffset, setGanttWeekOffset] = useState(0);
  const [ganttExpandedGroups, setGanttExpandedGroups] = useState<Set<string>>(new Set());
  const [ganttTaskOrder, setGanttTaskOrder] = useState<string[]>([]); // custom sort order by task id
  const [ganttSubtaskOrder, setGanttSubtaskOrder] = useState<Record<string, string[]>>({}); // custom sort order for subtasks by parent id
  const [ganttDragOverride, setGanttDragOverride] = useState<Record<string, { left: number; width: number }>>({});
  const ganttDragRef = useRef<{
    type: 'move' | 'resize';
    taskId: string;
    startX: number;
    origLeft: number;
    origWidth: number;
    origStartDate: Date;
    origEndDate: Date;
    dayW: number;
  } | null>(null);
  const ganttRowDragRef = useRef<{ taskId: string; startY: number; currentIdx: number } | null>(null);
  const [ganttRowDragOver, setGanttRowDragOver] = useState<string | null>(null);
  const [ganttRowDragging, setGanttRowDragging] = useState<string | null>(null); // taskId being dragged
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTab, setTaskTab] = useState<'details' | 'qa'>('details');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium' as Task['priority'],
    estimated_hours: 0,
    due_date: '',
    parent_task_id: '',
    checklist: [] as TaskChecklistItem[]
  });
  // Supervisor rejection reason input
  const [rejectionInput, setRejectionInput] = useState('');

  // Load Initial Data
  useEffect(() => {
    if (profile?.company_id) {
      loadData();
    }
  }, [profile?.company_id]);

  // Real-time Timer Counter
  useEffect(() => {
    if (activeTimerTaskId) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setTimerSeconds(0);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeTimerTaskId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load Profiles
      const { data: profs, error: profsError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('company_id', profile?.company_id);
      if (!profsError && profs) {
        setProfiles(profs);
      }

      // Load Projects
      const { data: projs, error: projsError } = await supabase
        .from('crm_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projsError) {
        // Table does not exist (migration not applied yet)
        console.warn("Project Management tables not yet available in DB. Falling back to local/mock experience.");
        setDbAvailable(false);
        loadMockData();
        return;
      }

      setDbAvailable(true);

      if (projs && projs.length > 0) {
        setProjects(projs);
        const savedProjId = localStorage.getItem('last_project_id');
        const defaultProjId = projs.find(p => p.id === savedProjId)?.id || projs[0].id;
        setSelectedProjectId(defaultProjId);
        await loadTasks(defaultProjId);
      } else {
        // No projects, trigger automatic seeding of ERP - Gasolineras
        toast.loading('Iniciando entorno de proyectos y cargando proyecto demo...', { id: 'seed' });
        await seedDemoProject(profile!.company_id);
        toast.success('¡Módulo inicializado con Proyecto ERP Gasolineras!', { id: 'seed' });
        loadData();
      }
    } catch (err) {
      console.error("Error loading project management:", err);
      toast.error("Error al inicializar módulo");
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (projectId: string) => {
    if (!projectId) return;
    try {
      if (dbAvailable) {
        const { data: tsks, error } = await supabase
          .from('crm_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        // Fetch active timer log if any
        const { data: activeLogs } = await supabase
          .from('crm_task_time_logs')
          .select('task_id, started_at')
          .is('stopped_at', null)
          .limit(1);

        if (activeLogs && activeLogs.length > 0) {
          setActiveTimerTaskId(activeLogs[0].task_id);
          const elapsed = Math.floor((Date.now() - new Date(activeLogs[0].started_at).getTime()) / 1000);
          setTimerSeconds(elapsed > 0 ? elapsed : 0);
        } else {
          setActiveTimerTaskId(null);
        }

        setTasks(tsks || []);
      } else {
        // Mock Mode Fallback
        const mockTasks: Task[] = JSON.parse(localStorage.getItem('mock_tasks') || '[]');
        setTasks(mockTasks.filter(t => t.project_id === projectId));
      }
    } catch (err) {
      console.error("Error loading tasks:", err);
    }
  };

  // Seeding Mock Data / Fallback System
  const loadMockData = () => {
    const mockProjs: Project[] = JSON.parse(localStorage.getItem('mock_projects') || '[]');
    const mockTasks: Task[] = JSON.parse(localStorage.getItem('mock_tasks') || '[]');
    
    if (mockProjs.length === 0 || mockTasks.length < 25) {
      const projId = 'mock-gas-erp-proj';
      const initialProj: Project = {
        id: projId,
        company_id: profile?.company_id || '0000',
        name: 'ERP - Gasolineras (Modo Demo Local)',
        description: 'Plan de implementación del sistema ERP para Gasolineras con estimaciones de arquitectura.',
        status: 'active',
        created_at: new Date().toISOString()
      };
      
      const fullTasksData = [
        { id: 'b1-1', title: 'B1-1: Resumen y apertura de turnos', description: 'Refactorización ágil de UI en Antigravity para optimizar el inicio de operarios en pista.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b1-2', title: 'B1-2: Consulta turnos cerrados / sin cerrar', description: 'Unificación de pantallas de consulta. Indexación de tablas de auditoría en la capa de datos.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b1-3', title: 'B1-3: Cierres de caja - códigos para turnos y supervisores', description: 'Módulo de seguridad nativo. Autenticación ágil y validación de PIN para arqueos inmediatos.', priority: 'high' as const, estimated_hours: 5.0, status: 'todo' as const },
        { id: 'b1-4', title: 'B1-4: Código de autorización para otorgar descuentos', description: 'Backend de políticas de precios interactivo con alertas en tiempo real en la facturación.', priority: 'medium' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b1-5', title: 'B1-5: Ingreso de lecturas físicas de surtidores', description: 'Crítico para Gasolineras. Formulario optimizado de captura de lecturas físicas vs sistema.', priority: 'urgent' as const, estimated_hours: 5.5, status: 'todo' as const },
        { id: 'b2-1', title: 'B2-1: Facturación (Optimización General)', description: 'Ajuste de flujos API en Antigravity para soportar alta concurrencia en horas pico.', priority: 'medium' as const, estimated_hours: 2.0, status: 'in_progress' as const },
        { id: 'b2-2', title: 'B2-2: Facturación en pista (Precios semanales)', description: 'Sincronización automatizada del precio por galón configurado con los DTEs electrónicos.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b2-3', title: 'B2-3: Facturación en tienda (Impuesto Ad-Valorem alcohol)', description: 'Lógica matemática de cálculo dinámico de impuestos directo en el checkout de retail.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b2-4', title: 'B2-4: Facturación en oficina administrativa', description: 'Emisión ágil de DTEs globales y gestión rápida de créditos corporativos pre-aprobados.', priority: 'medium' as const, estimated_hours: 1.5, status: 'todo' as const },
        { id: 'b2-5', title: 'B2-5: Pagos de clientes (Pasarela Multimoneda)', description: 'Integración de componentes de pago (Efectivo, Tarjetas, Vales de flotas, códigos QR).', priority: 'high' as const, estimated_hours: 5.0, status: 'todo' as const },
        { id: 'b2-6', title: 'B2-6: Cambio de precio programado', description: 'Automatización cronometrada de cambios de precios a medianoche sin detener facturación.', priority: 'high' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b2-7', title: 'B2-7: Vales al crédito / Vales por cliente', description: 'Módulo de cuentas por cobrar para flotas comerciales con validación de saldos en la nube.', priority: 'high' as const, estimated_hours: 5.5, status: 'todo' as const },
        { id: 'b3-1', title: 'B3-1: Gestión de inventarios / Existencias por bodega', description: 'Dashboard minimalista en tiempo real del estado de tanques de combustible y stock.', priority: 'medium' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b3-2', title: 'B3-2: Movimientos por bodega / Kardex por línea', description: 'Optimización de queries de inventario. Trazabilidad completa de cargas de cisternas.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b3-3', title: 'B3-3: Cambios de precio de gasolina e historial', description: 'Log inmutable para auditorías externas y entes reguladores de hidrocarburos.', priority: 'high' as const, estimated_hours: 3.5, status: 'todo' as const },
        { id: 'b3-4', title: 'B3-4: Reporte de artículos con existencia mínima', description: 'Alertas visuales proactivas para compras automatizadas de consumibles y aceites.', priority: 'high' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b3-5', title: 'B3-5: Precio sugerido para bebidas alcohólicas', description: 'Matriz rápida de márgenes y sincronización ágil con el POS de la tienda.', priority: 'medium' as const, estimated_hours: 2.5, status: 'todo' as const },
        { id: 'b4-1', title: 'B4-1: Reporte Factura Sujeto Excluido / Retenciones', description: 'Plantillas y mapeo de DTEs exigidos por el fisco usando esquemas rápidos.', priority: 'high' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b4-2', title: 'B4-2: Informe Ad Valorem (Diferencial tabaco/alcohol)', description: 'Query analítica que cruza costos, precios sugeridos y volumen de despacho real.', priority: 'high' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b4-3', title: 'B4-3: Reporte de economía distribuidora G&C', description: 'Estructuración y exportación personalizada de datos según requerimiento de junta.', priority: 'high' as const, estimated_hours: 5.0, status: 'todo' as const },
        { id: 'b4-4', title: 'B4-4: Total X y Z por período / Informe diario', description: 'Cierres fiscales automatizados basados en el estándar estricto de POS.', priority: 'high' as const, estimated_hours: 6.0, status: 'todo' as const },
        { id: 'b4-5', title: 'B4-5: Módulo de Ventas Avanzado (Por período, forma pago)', description: 'Unificación y visualización ágil de datos existentes a vistas limpias y exportables.', priority: 'medium' as const, estimated_hours: 4.0, status: 'todo' as const },
        { id: 'b4-6', title: 'B4-6: Utilidad detallada, consolidada y por línea', description: 'Motor analítico de rentabilidad (Precio Venta - Costo Promedio Ponderado).', priority: 'high' as const, estimated_hours: 6.0, status: 'todo' as const },
        { id: 'b4-7', title: 'B4-7: Cierre diario de pista (Comparativo vs Facturación)', description: 'Conciliación automatizada: Despacho real de surtidores vs DTEs emitidos.', priority: 'high' as const, estimated_hours: 5.0, status: 'todo' as const },
        { id: 'b4-8', title: 'B4-8: Lecturas diarias / Movimientos / Exportaciones', description: 'Reportes operacionales específicos consolidados para administración central.', priority: 'high' as const, estimated_hours: 5.0, status: 'todo' as const },
        { id: 'b4-9', title: 'B4-9: Consolidado de DTEs / Documentos anulados', description: 'Grilla de datos de alta velocidad con filtros avanzados por UID fiscal.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b4-10', title: 'B4-10: Libro de compras (Comprobantes de liquidación)', description: 'Adaptación multi-sucursal modular para mantener control unificado o independiente.', priority: 'medium' as const, estimated_hours: 2.0, status: 'todo' as const },
        { id: 'b4-11', title: 'B4-11: Retenciones, Percepciones y 2% POS', description: 'Cálculo e informes automáticos de comisiones de adquirencia de tarjetas.', priority: 'high' as const, estimated_hours: 5.0, status: 'todo' as const },
        { id: 'b4-12', title: 'B4-12: Inicializar cinta de auditoría', description: 'Procedimiento seguro en backend para reseteo y foliación de logs transaccionales.', priority: 'high' as const, estimated_hours: 3.0, status: 'completed' as const }
      ];

      const initialTasks: Task[] = fullTasksData.map(t => ({
        ...t,
        project_id: projId,
        actual_hours: t.status === 'in_progress' ? 1.5 : (t.status === 'completed' ? t.estimated_hours : 0),
        start_date: t.status === 'completed' ? new Date().toISOString() : null,
        due_date: t.status === 'completed' ? new Date().toISOString() : null,
        completed_at: t.status === 'completed' ? new Date().toISOString() : null,
        created_at: new Date().toISOString()
      }));

      localStorage.setItem('mock_projects', JSON.stringify([initialProj]));
      localStorage.setItem('mock_tasks', JSON.stringify(initialTasks));
      setProjects([initialProj]);
      setSelectedProjectId(projId);
      setTasks(initialTasks);
    } else {
      setProjects(mockProjs);
      const savedProjId = localStorage.getItem('last_project_id');
      const defaultProjId = mockProjs.find(p => p.id === savedProjId)?.id || mockProjs[0].id;
      setSelectedProjectId(defaultProjId);
      setTasks(mockTasks.filter(t => t.project_id === defaultProjId));
    }
    setLoading(false);
  };

  const seedDemoProject = async (companyId: string) => {
    // 1. Create project
    const { data: project, error: pError } = await supabase
      .from('crm_projects')
      .insert({
        company_id: companyId,
        name: 'ERP - Gasolineras',
        description: 'Plan de implementación del sistema ERP para Gasolineras con estimaciones de arquitectura.',
        status: 'active'
      })
      .select()
      .single();
    
    if (pError) throw pError;

    // 2. Insert tasks
    const tasksToInsert = [
      // Bloque 1
      { project_id: project.id, title: 'B1-1: Resumen y apertura de turnos', description: 'Refactorización ágil de UI en Antigravity para optimizar el inicio de operarios en pista.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B1-2: Consulta turnos cerrados / sin cerrar', description: 'Unificación de pantallas de consulta. Indexación de tablas de auditoría en la capa de datos.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B1-3: Cierres de caja - turnos y supervisores', description: 'Módulo de seguridad nativo. Autenticación ágil y validación de PIN para arqueos inmediatos.', priority: 'high', estimated_hours: 5.0, status: 'todo' },
      { project_id: project.id, title: 'B1-4: Autorización para otorgar descuentos', description: 'Backend de políticas de precios interactivo con alertas en tiempo real en la facturación.', priority: 'medium', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B1-5: Lecturas físicas de surtidores', description: 'Crítico para Gasolineras. Formulario optimizado de captura de lecturas físicas vs sistema.', priority: 'urgent', estimated_hours: 5.5, status: 'todo' },
      // Bloque 2
      { project_id: project.id, title: 'B2-1: Facturación (Optimización General)', description: 'Ajuste de flujos API en Antigravity para soportar alta concurrencia en horas pico.', priority: 'medium', estimated_hours: 2.0, status: 'in_progress' },
      { project_id: project.id, title: 'B2-2: Facturación en pista (Precios semanales)', description: 'Sincronización automatizada del precio por galón configurado con los DTEs electrónicos.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B2-3: Facturación en tienda (Impuestos)', description: 'Lógica matemática de cálculo dinámico de impuestos directo en el checkout de retail.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B2-4: Facturación en oficina administrativa', description: 'Emisión ágil de DTEs globales y gestión rápida de créditos corporativos pre-aprobados.', priority: 'medium', estimated_hours: 1.5, status: 'todo' },
      { project_id: project.id, title: 'B2-5: Pagos de clientes (Pasarela)', description: 'Integración de componentes de pago (Efectivo, Tarjetas, Vales de flotas, códigos QR).', priority: 'high', estimated_hours: 5.0, status: 'todo' },
      { project_id: project.id, title: 'B2-6: Cambio de precio programado', description: 'Automatización cronometrada de cambios de precios a medianoche sin detener facturación.', priority: 'high', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B2-7: Vales al crédito / Vales por cliente', description: 'Módulo de cuentas por cobrar para flotas comerciales con validación de saldos en la nube.', priority: 'high', estimated_hours: 5.5, status: 'todo' },
      // Bloque 3
      { project_id: project.id, title: 'B3-1: Gestión de inventarios / Existencias', description: 'Dashboard minimalista en tiempo real del estado de tanques de combustible y stock.', priority: 'medium', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B3-2: Movimientos por bodega / Kardex', description: 'Optimización de queries de inventario. Trazabilidad completa de cargas de cisternas.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B3-3: Cambios de precio de gasolina', description: 'Log inmutable para auditorías externas y entes reguladores de hidrocarburos.', priority: 'high', estimated_hours: 3.5, status: 'todo' },
      { project_id: project.id, title: 'B3-4: Reporte de artículos con existencia mínima', description: 'Alertas visuales proactivas para compras automatizadas de consumibles y aceites.', priority: 'high', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B3-5: Precio sugerido para bebidas alcohólicas', description: 'Matriz rápida de márgenes y sincronización ágil con el POS de la tienda.', priority: 'medium', estimated_hours: 2.5, status: 'todo' },
      // Bloque 4
      { project_id: project.id, title: 'B4-1: Reporte Factura Sujeto Excluido', description: 'Plantillas y mapeo de DTEs exigidos por el fisco usando esquemas rápidos.', priority: 'high', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B4-2: Informe Ad Valorem (Tabaco/Alcohol)', description: 'Query analítica que cruza costos, precios sugeridos y volumen de despacho real.', priority: 'high', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B4-3: Reporte de economía distribuidora G&C', description: 'Estructuración y exportación personalizada de datos según requerimiento de junta.', priority: 'high', estimated_hours: 5.0, status: 'todo' },
      { project_id: project.id, title: 'B4-4: Total X y Z por período / Informe diario', description: 'Cierres fiscales automatizados basados en el estándar estricto de POS.', priority: 'high', estimated_hours: 6.0, status: 'todo' },
      { project_id: project.id, title: 'B4-5: Módulo de Ventas Avanzado', description: 'Unificación y visualización ágil de datos existentes a vistas limpias y exportables.', priority: 'medium', estimated_hours: 4.0, status: 'todo' },
      { project_id: project.id, title: 'B4-6: Utilidad detallada, consolidada y por línea', description: 'Motor analítico de rentabilidad (Precio Venta - Costo Promedio Ponderado).', priority: 'high', estimated_hours: 6.0, status: 'todo' },
      { project_id: project.id, title: 'B4-7: Cierre diario de pista', description: 'Conciliación automatizada: Despacho real de surtidores vs DTEs emitidos.', priority: 'high', estimated_hours: 5.0, status: 'todo' },
      { project_id: project.id, title: 'B4-8: Lecturas diarias / Movimientos', description: 'Reportes operacionales específicos consolidados para administración central.', priority: 'high', estimated_hours: 5.0, status: 'todo' },
      { project_id: project.id, title: 'B4-9: Consolidado de DTEs / Anulados', description: 'Grilla de datos de alta velocidad con filtros avanzados por UID fiscal.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B4-10: Libro de compras', description: 'Adaptación multi-sucursal modular para mantener control unificado o independiente.', priority: 'medium', estimated_hours: 2.0, status: 'todo' },
      { project_id: project.id, title: 'B4-11: Retenciones, Percepciones y 2% POS', description: 'Cálculo e informes automáticos de comisiones de adquirencia de tarjetas.', priority: 'high', estimated_hours: 5.0, status: 'todo' },
      { project_id: project.id, title: 'B4-12: Inicializar cinta de auditoría', description: 'Procedimiento seguro en backend para reseteo y foliación de logs transaccionales.', priority: 'high', estimated_hours: 3.0, status: 'completed', completed_at: new Date().toISOString() }
    ];

    const { error: tError } = await supabase
      .from('crm_tasks')
      .insert(tasksToInsert);

    if (tError) throw tError;
  };

  // Project Actions
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;

    try {
      if (dbAvailable) {
        const { data, error } = await supabase
          .from('crm_projects')
          .insert({
            company_id: profile?.company_id,
            name: newProject.name,
            description: newProject.description,
            status: 'active'
          })
          .select()
          .single();

        if (error) throw error;
        setProjects(prev => [data, ...prev]);
        setSelectedProjectId(data.id);
        localStorage.setItem('last_project_id', data.id);
        setTasks([]);
      } else {
        // Mock Mode
        const newProjId = `mock-${Date.now()}`;
        const newP: Project = {
          id: newProjId,
          company_id: profile?.company_id || '0000',
          name: newProject.name,
          description: newProject.description,
          status: 'active',
          created_at: new Date().toISOString()
        };
        const updatedProjs = [newP, ...projects];
        setProjects(updatedProjs);
        setSelectedProjectId(newProjId);
        setTasks([]);
        localStorage.setItem('mock_projects', JSON.stringify(updatedProjs));
      }

      toast.success("Proyecto creado exitosamente");
      setIsProjectModalOpen(false);
      setNewProject({ name: '', description: '' });
    } catch (err) {
      toast.error("Error al crear proyecto");
    }
  };

  // ── Task Actions ────────────────────────────────────────────
  const openTaskModal = (task: Task | null = null, parentTaskId: string | null = null) => {
    if (task) {
      setSelectedTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to || '',
        priority: task.priority,
        estimated_hours: task.estimated_hours,
        due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
        parent_task_id: task.parent_task_id || '',
        checklist: task.checklist || []
      });
    } else {
      setSelectedTask(null);
      setTaskForm({
        title: '',
        description: '',
        assigned_to: '',
        priority: 'medium',
        estimated_hours: 0,
        due_date: '',
        parent_task_id: parentTaskId || '',
        checklist: []
      });
    }
    setRejectionInput('');
    setIsTaskModalOpen(true);
  };

  // ── QA Checklist item change with auto-rejection logic ───────
  const handleChecklistItemChange = async (
    idx: number,
    field: 'status' | 'text',
    value: string
  ) => {
    const newChks = [...taskForm.checklist];
    (newChks[idx] as any)[field] = value;
    setTaskForm(prev => ({ ...prev, checklist: newChks }));

    // Auto-reject task if any test is marked failed
    if (field === 'status' && value === 'failed' && selectedTask) {
      const reason = `Test automaticamente fallido: "${newChks[idx].text || 'Sin nombre'}"`;
      try {
        if (dbAvailable) {
          const { data, error } = await supabase
            .from('crm_tasks')
            .update({ status: 'rejected', rejection_reason: reason, checklist: newChks, updated_at: new Date().toISOString() })
            .eq('id', selectedTask.id)
            .select().single();
          if (!error && data) {
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
            setSelectedTask(data);
          }
        }
        toast.error('❌ Test fallido — tarea rechazada automáticamente');
      } catch (err) { console.error(err); }
    }

    // Auto-clear rejection if ALL items now pass
    if (field === 'status' && value !== 'failed' && selectedTask) {
      const allPass = newChks.every(c => c.status === 'passed');
      if (allPass && selectedTask.status === 'rejected') {
        try {
          if (dbAvailable) {
            const { data, error } = await supabase
              .from('crm_tasks')
              .update({ status: 'in_progress', rejection_reason: null, checklist: newChks, updated_at: new Date().toISOString() })
              .eq('id', selectedTask.id)
              .select().single();
            if (!error && data) {
              setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
              setSelectedTask(data);
            }
          }
          toast.success('✅ Todos los tests pasados — listo para enviar');
        } catch (err) { console.error(err); }
      }
    }
  };

  // ── Submit task for supervisor approval ──────────────────────
  const handleSubmitForApproval = async () => {
    if (!selectedTask) return;
    const hasFailures = taskForm.checklist.some(c => c.status === 'failed');
    const hasPending  = taskForm.checklist.some(c => c.status === 'pending');
    if (hasFailures) { toast.error('Corrige los tests fallidos antes de enviar'); return; }
    if (hasPending)  { toast.error('Completa todos los casos de prueba antes de enviar'); return; }
    if (taskForm.checklist.length === 0) { toast.error('Agrega al menos un caso de prueba'); return; }
    try {
      const now = new Date().toISOString();
      if (dbAvailable) {
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({ status: 'pending_approval', submitted_at: now, rejection_reason: null, checklist: taskForm.checklist, updated_at: now })
          .eq('id', selectedTask.id)
          .select().single();
        if (error) throw error;
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
        setSelectedTask(data);
      }
      toast.success('📋 Tarea enviada para revisión del supervisor');
    } catch (err) {
      toast.error('Error al enviar para aprobación');
    }
  };

  // ── Supervisor: Approve task ─────────────────────────────────
  const handleApproveTask = async () => {
    if (!selectedTask || !profile?.id) return;
    try {
      const now = new Date().toISOString();
      if (dbAvailable) {
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({ status: 'completed', approved_by: profile.id, approved_at: now, rejection_reason: null, completed_at: now, updated_at: now })
          .eq('id', selectedTask.id)
          .select().single();
        if (error) throw error;
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
        setSelectedTask(data);
      }
      toast.success('✅ Tarea aprobada y marcada como completada');
    } catch (err) {
      toast.error('Error al aprobar tarea');
    }
  };

  // ── Supervisor: Reject task ──────────────────────────────────
  const handleRejectTask = async () => {
    if (!selectedTask) return;
    if (!rejectionInput.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    try {
      const now = new Date().toISOString();
      if (dbAvailable) {
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({ status: 'rejected', rejection_reason: rejectionInput.trim(), approved_by: null, approved_at: null, updated_at: now })
          .eq('id', selectedTask.id)
          .select().single();
        if (error) throw error;
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
        setSelectedTask(data);
      }
      setRejectionInput('');
      toast.error(`🚫 Tarea rechazada: ${rejectionInput.trim()}`);
    } catch (err) {
      toast.error('Error al rechazar tarea');
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title) return;

    try {
      const parentIdVal = taskForm.parent_task_id || null;

      if (selectedTask) {
        // Update Task
        if (dbAvailable) {
          const { data, error } = await supabase
             .from('crm_tasks')
             .update({
               title: taskForm.title,
               description: taskForm.description,
               assigned_to: taskForm.assigned_to || null,
               priority: taskForm.priority,
               estimated_hours: taskForm.estimated_hours,
               due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
               parent_task_id: parentIdVal,
               checklist: taskForm.checklist,
               updated_at: new Date().toISOString()
             })
             .eq('id', selectedTask.id)
             .select()
             .single();

          if (error) throw error;
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
        } else {
          // Mock update
          const updated = {
            ...selectedTask,
            title: taskForm.title,
            description: taskForm.description,
            assigned_to: taskForm.assigned_to || null,
            priority: taskForm.priority,
            estimated_hours: taskForm.estimated_hours,
            due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
            parent_task_id: parentIdVal,
            checklist: taskForm.checklist
          };
          const newTasks = tasks.map(t => t.id === selectedTask.id ? updated : t);
          setTasks(newTasks);
          saveMockTasks(newTasks);
        }
        toast.success("Tarea actualizada");
      } else {
        // Create Task
        if (dbAvailable) {
          const { data, error } = await supabase
             .from('crm_tasks')
             .insert({
               project_id: selectedProjectId,
               title: taskForm.title,
               description: taskForm.description,
               assigned_to: taskForm.assigned_to || null,
               priority: taskForm.priority,
               estimated_hours: taskForm.estimated_hours,
               due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
               parent_task_id: parentIdVal,
               checklist: taskForm.checklist,
               status: 'todo'
             })
             .select()
             .single();

          if (error) throw error;
          setTasks(prev => [...prev, data]);
        } else {
          // Mock Create
          const mockT: Task = {
            id: `mock-task-${Date.now()}`,
            project_id: selectedProjectId,
            title: taskForm.title,
            description: taskForm.description,
            assigned_to: taskForm.assigned_to || null,
            priority: taskForm.priority,
            estimated_hours: taskForm.estimated_hours,
            actual_hours: 0,
            start_date: null,
            due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
            parent_task_id: parentIdVal,
            completed_at: null,
            checklist: taskForm.checklist,
            status: 'todo',
            created_at: new Date().toISOString()
          };
          const newTasks = [...tasks, mockT];
          setTasks(newTasks);
          saveMockTasks(newTasks);
        }
        toast.success("Tarea creada");
      }
      setIsTaskModalOpen(false);
    } catch (err) {
      toast.error("Error al guardar tarea");
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
      const startDate = newStatus === 'in_progress' ? new Date().toISOString() : undefined;
      
      if (dbAvailable) {
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({
            status: newStatus,
            completed_at: completedAt,
            ...(startDate ? { start_date: startDate } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId)
          .select()
          .single();

        if (error) throw error;
        setTasks(prev => prev.map(t => t.id === taskId ? data : t));
      } else {
        // Mock update status
        const original = tasks.find(t => t.id === taskId)!;
        const updated = {
          ...original,
          status: newStatus,
          completed_at: completedAt,
          ...(startDate ? { start_date: startDate } : {})
        };
        const newTasks = tasks.map(t => t.id === taskId ? updated : t);
        setTasks(newTasks);
        saveMockTasks(newTasks);
      }
      
      // Handle timer logic automatically if moved to in_progress
      if (newStatus === 'in_progress') {
        if (activeTimerTaskId && activeTimerTaskId !== taskId) {
          // Pause previous active timer
          await handleStopTimer(activeTimerTaskId);
        }
        await handleStartTimer(taskId);
      } else if (taskId === activeTimerTaskId && (newStatus === 'completed' || newStatus === 'todo' || newStatus === 'paused')) {
        await handleStopTimer(taskId);
      }

      toast.success(`Estado actualizado a: ${newStatus}`);
    } catch (err) {
      toast.error("Error al actualizar estado");
    }
  };

  // ── Gantt: save date changes after horizontal bar drag ──
  const handleUpdateTaskDates = async (taskId: string, startDate: Date, dueDate: Date) => {
    const upd = { start_date: startDate.toISOString(), due_date: dueDate.toISOString(), updated_at: new Date().toISOString() };
    if (dbAvailable) {
      const { data, error } = await supabase.from('crm_tasks').update(upd).eq('id', taskId).select().single();
      if (!error && data) setTasks(prev => prev.map(t => t.id === taskId ? data : t));
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...upd } : t));
    }
  };

  // ── Gantt: global mouse handlers for bar drag & row reorder ──
  useEffect(() => {
    const DAY_W = 36;
    const ROW_H = 58;

    const onMove = (e: MouseEvent) => {
      // Horizontal bar drag
      const d = ganttDragRef.current;
      if (d) {
        const dx = e.clientX - d.startX;
        const days = Math.round(dx / d.dayW);
        if (d.type === 'move') {
          setGanttDragOverride(p => ({ ...p, [d.taskId]: { left: Math.max(0, d.origLeft + days * d.dayW), width: d.origWidth } }));
        } else {
          setGanttDragOverride(p => ({ ...p, [d.taskId]: { left: d.origLeft, width: Math.max(d.dayW, d.origWidth + days * d.dayW) } }));
        }
      }
      // Vertical row drag
      const rd = ganttRowDragRef.current;
      if (rd) {
        const dy = e.clientY - rd.startY;
        const rowDelta = Math.round(dy / ROW_H);
        rd.currentIdx = rowDelta;
        // find which task we're hovering over
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const rowEl = el?.closest('[data-gantt-row]');
        const hoveredId = rowEl?.getAttribute('data-gantt-row') ?? null;
        setGanttRowDragOver(hoveredId);
      }
    };

    const onUp = async (e: MouseEvent) => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Horizontal: save dates
      const d = ganttDragRef.current;
      if (d) {
        const dx = e.clientX - d.startX;
        const days = Math.round(dx / d.dayW);
        const ns = new Date(d.origStartDate); ns.setDate(ns.getDate() + (d.type === 'move' ? days : 0));
        const ne = new Date(d.origEndDate);   ne.setDate(ne.getDate() + days);
        if (ne <= ns) ne.setDate(ns.getDate() + 1);
        ganttDragRef.current = null;
        setGanttDragOverride(p => { const n = {...p}; delete n[d.taskId]; return n; });
        await handleUpdateTaskDates(d.taskId, ns, ne);
      }

      // Vertical: reorder
      const rd = ganttRowDragRef.current;
      if (rd) {
        const hoveredId = ganttRowDragOver;
        ganttRowDragRef.current = null;
        setGanttRowDragging(null);
        setGanttRowDragOver(null);
        if (hoveredId && hoveredId !== rd.taskId) {
          const draggedTask = tasks.find(t => t.id === rd.taskId);
          const hoveredTask = tasks.find(t => t.id === hoveredId);
          if (draggedTask && hoveredTask && draggedTask.parent_task_id === hoveredTask.parent_task_id) {
            const parentId = draggedTask.parent_task_id;
            if (parentId) {
              setGanttSubtaskOrder(prev => {
                const siblings = tasks.filter(t => t.parent_task_id === parentId);
                const ordered = prev[parentId] ?? siblings.map(t => t.id);
                const from = ordered.indexOf(rd.taskId);
                const to = ordered.indexOf(hoveredId);
                if (from === -1 || to === -1) return prev;
                const next = [...ordered];
                next.splice(from, 1);
                next.splice(to, 0, rd.taskId);
                return { ...prev, [parentId]: next };
              });
            } else {
              setGanttTaskOrder(prev => {
                const ordered = prev.length ? prev : tasks.filter(t => !t.parent_task_id).map(t => t.id);
                const from = ordered.indexOf(rd.taskId);
                const to   = ordered.indexOf(hoveredId);
                if (from === -1 || to === -1) return prev;
                const next = [...ordered];
                next.splice(from, 1);
                next.splice(to, 0, rd.taskId);
                return next;
              });
            }
          }
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [tasks, ganttRowDragOver]);

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta tarea?")) return;
    try {
      if (dbAvailable) {
        const { error } = await supabase
          .from('crm_tasks')
          .delete()
          .eq('id', taskId);
        if (error) throw error;
      }
      
      const newTasks = tasks.filter(t => t.id !== taskId);
      setTasks(newTasks);
      if (!dbAvailable) saveMockTasks(newTasks);
      
      if (taskId === activeTimerTaskId) {
        setActiveTimerTaskId(null);
      }
      toast.success("Tarea eliminada");
    } catch (err) {
      toast.error("Error al eliminar tarea");
    }
  };

  // Timer Handlers
  const handleStartTimer = async (taskId: string) => {
    try {
      if (dbAvailable) {
        // Stop any current running logs
        const { data: currentLogs } = await supabase
          .from('crm_task_time_logs')
          .select('id')
          .is('stopped_at', null);

        if (currentLogs && currentLogs.length > 0) {
          for (const log of currentLogs) {
            await supabase
              .from('crm_task_time_logs')
              .update({ stopped_at: new Date().toISOString() })
              .eq('id', log.id);
          }
        }

        // Insert new active log
        const { error } = await supabase
          .from('crm_task_time_logs')
          .insert({
            task_id: taskId,
            profile_id: profile?.id,
            started_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      setActiveTimerTaskId(taskId);
      setTimerSeconds(0);
      toast.success("Temporizador iniciado");
    } catch (err) {
      console.error(err);
      toast.error("Error al iniciar temporizador");
    }
  };

  const handleStopTimer = async (taskId: string) => {
    try {
      if (dbAvailable) {
        // Find active log for this task
        const { data: activeLog, error: fetchErr } = await supabase
          .from('crm_task_time_logs')
          .select('id, started_at')
          .eq('task_id', taskId)
          .is('stopped_at', null)
          .single();

        if (activeLog) {
          const nowStr = new Date().toISOString();
          const elapsedSecs = Math.floor((Date.now() - new Date(activeLog.started_at).getTime()) / 1000);
          const elapsedHours = elapsedSecs / 3600;

          // Stop log
          const { error: stopErr } = await supabase
            .from('crm_task_time_logs')
            .update({ stopped_at: nowStr })
            .eq('id', activeLog.id);

          if (stopErr) throw stopErr;

          // Increment actual_hours in task
          const taskObj = tasks.find(t => t.id === taskId);
          if (taskObj) {
            const newActualHours = (taskObj.actual_hours || 0) + elapsedHours;
            await supabase
              .from('crm_tasks')
              .update({ actual_hours: newActualHours })
              .eq('id', taskId);
            
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, actual_hours: newActualHours } : t));
          }
        }
      } else {
        // Mock Mode Stop Timer
        const elapsedHours = timerSeconds / 3600;
        const taskObj = tasks.find(t => t.id === taskId);
        if (taskObj) {
          const newActualHours = (taskObj.actual_hours || 0) + elapsedHours;
          const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, actual_hours: newActualHours } : t);
          setTasks(updatedTasks);
          saveMockTasks(updatedTasks);
        }
      }
      setActiveTimerTaskId(null);
      setTimerSeconds(0);
      toast.success("Registro de tiempo guardado");
    } catch (err) {
      console.error(err);
      toast.error("Error al detener temporizador");
    }
  };

  const saveMockTasks = (updated: Task[]) => {
    const allMockTasks: Task[] = JSON.parse(localStorage.getItem('mock_tasks') || '[]');
    const otherProjectsTasks = allMockTasks.filter(t => t.project_id !== selectedProjectId);
    localStorage.setItem('mock_tasks', JSON.stringify([...otherProjectsTasks, ...updated]));
  };

  // Helper selectors
  const getAssignedProfile = (profileId: string | null | undefined) => {
    return profiles.find(p => p.id === profileId);
  };

  const getFilteredTasks = () => {
    return tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchFilter.toLowerCase()) || 
                            t.description?.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  };

  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getDeviations = (task: Task) => {
    const limit = task.estimated_hours || 1;
    const ratio = ((task.actual_hours ?? 0) / limit) * 100;
    
    // Default: On Track (A tiempo)
    let color = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    let label = 'A tiempo';

    if (task.status === 'completed') {
      if (task.due_date && task.completed_at && new Date(task.completed_at) > new Date(task.due_date)) {
        color = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        label = 'Completado Tarde';
      } else {
        color = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        label = 'Completado';
      }
    } else {
      // Overdue check
      if (task.due_date) {
        const today = new Date();
        const due = new Date(task.due_date);
        today.setHours(0,0,0,0);
        due.setHours(0,0,0,0);
        
        if (today > due) {
          color = 'text-rose-600 bg-rose-600/10 border-rose-600/20';
          label = 'Atrasado';
        } else if (today.getTime() === due.getTime() || (due.getTime() - today.getTime()) <= 86400000 * 2) {
          color = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
          label = 'En Riesgo';
        }
      }

      // Hours budget check
      if ((task.actual_hours ?? 0) > (task.estimated_hours ?? 0) && (task.estimated_hours ?? 0) > 0) {
        color = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        label = 'Retraso Horas';
      }
    }
    
    return { color, label, ratio };
  };

  const getTaskTotalMetrics = () => {
    const totalEst = tasks.reduce((acc, t) => acc + Number(t.estimated_hours), 0);
    const totalAct = tasks.reduce((acc, t) => acc + Number(t.actual_hours), 0);
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
    return { totalEst, totalAct, progressPercent, completedCount };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Cargando Proyectos...</p>
      </div>
    );
  }

  const filteredTasks = getFilteredTasks();
  const metrics = getTaskTotalMetrics();

  // ── LIST VIEW HELPERS ── defined OUTSIDE return() so React keeps stable references
  const statusCfg: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    todo:             { label: 'Pendiente',       dot: 'bg-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-600'  },
    in_progress:      { label: 'En Progreso',     dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700'   },
    paused:           { label: 'Pausada',         dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
    pending_approval: { label: 'En Revisión',     dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
    rejected:         { label: 'Rechazada',       dot: 'bg-rose-600',   bg: 'bg-rose-50',   text: 'text-rose-700'   },
    completed:        { label: 'Completada',      dot: 'bg-emerald-500',bg: 'bg-emerald-50',text: 'text-emerald-700'},
  };

  const priorCfg: Record<string, string> = {
    urgent: 'bg-rose-100 text-rose-600',
    high: 'bg-amber-100 text-amber-700',
    medium: 'bg-indigo-50 text-indigo-600',
    low: 'bg-gray-100 text-gray-500',
  };

  const parentTasks = filteredTasks.filter(t => !t.parent_task_id);
  const getSubtasksOf = (parentId: string) => filteredTasks.filter(t => t.parent_task_id === parentId);

  const renderTaskRow = (task: Task, isSubtask = false): React.ReactNode => {
    const assigned = getAssignedProfile(task.assigned_to);
    const health = getDeviations(task);
    const sub = getSubtasksOf(task.id);
    const isExpanded = expandedTaskIds.has(task.id);
    const hasChildren = sub.length > 0;
    const sc = statusCfg[task.status] ?? statusCfg.todo;
    const pct = (task.estimated_hours ?? 0) > 0 ? Math.min(((task.actual_hours ?? 0) / (task.estimated_hours ?? 1)) * 100, 100) : 0;
    const overBudget = (task.actual_hours ?? 0) > (task.estimated_hours ?? 0);

    return (
      <React.Fragment key={task.id}>
        <div
          className={`group grid grid-cols-[minmax(0,1fr)_130px_150px_100px_90px_90px_110px_95px] px-5 py-4 border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${isSubtask ? 'bg-gray-50/30' : ''}`}
        >
          {/* Task name + expand toggle */}
          <div className={`flex items-center gap-2.5 min-w-0 ${isSubtask ? 'pl-6' : ''}`}>
            {/* Checkbox-style completion toggle */}
            <button
              type="button"
              onClick={() => handleUpdateStatus(task.id, task.status === 'completed' ? 'todo' : 'completed')}
              className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                task.status === 'completed'
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-gray-300 hover:border-[#4449AA]'
              }`}
            >
              {task.status === 'completed' && <CheckCircle2 size={11} className="text-white" />}
            </button>

            {/* Expand chevron for parent tasks */}
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleExpand(task.id); }}
                className="text-indigo-400 hover:text-indigo-600 shrink-0 transition-colors p-0.5 rounded hover:bg-indigo-50"
                aria-expanded={isExpanded}
                aria-controls={`subtasks-${task.id}`}
                title={isExpanded ? 'Colapsar subtareas' : 'Expandir subtareas'}
              >
                <ChevronRight size={15} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
            )}
            {!hasChildren && <span className="w-4.5 shrink-0" />}

            {/* Title & description */}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => openTaskModal(task)}
                className={`text-sm font-bold text-left truncate block max-w-full hover:text-[#4449AA] transition-colors ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}
              >
                {task.title}
              </button>
              {task.description && !isSubtask && (
                <span className="text-xs text-gray-400 line-clamp-1 block leading-tight mt-1">{task.description}</span>
              )}
              {task.checklist && task.checklist.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-gray-400">
                  <CheckCircle2 size={12} className={task.checklist.every(c => c.status === 'passed') ? "text-emerald-500" : "text-indigo-400"} />
                  {task.checklist.filter(c => c.status === 'passed').length}/{task.checklist.length}
                </div>
              )}
              {/* Progress bar */}
              <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden max-w-[180px]">
                <div
                  className={`h-full rounded-full transition-all ${overBudget ? 'bg-rose-400' : 'bg-emerald-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Assigned */}
          <div className="flex items-center">
            {assigned ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#4449AA]/10 text-[#4449AA] flex items-center justify-center text-xs font-black shrink-0">
                  {(assigned.full_name || assigned.email || 'U').charAt(0)}
                </div>
                <span className="text-xs text-gray-600 font-semibold truncate">{(assigned.full_name || assigned.email || 'Usuario').split(' ')[0]}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300 flex items-center gap-1.5"><User size={12} /> —</span>
            )}
          </div>

          {/* Status pill */}
          <div className="flex items-center">
            <select
              value={task.status}
              onChange={e => handleUpdateStatus(task.id, e.target.value as Task['status'])}
              className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-xl border border-gray-200/40 outline-none cursor-pointer ${sc.bg} ${sc.text}`}
            >
              <option value="todo">Pendiente</option>
              <option value="in_progress">En Progreso</option>
              <option value="paused">Pausada</option>
              <option value="completed">Completada</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl ${priorCfg[task.priority] ?? priorCfg.low}`}>
              {task.priority === 'urgent' ? '🔥 Urg' : task.priority === 'high' ? '⚡ Alt' : task.priority}
            </span>
          </div>

          {/* Est. */}
          <div className="flex items-center">
            <span className="text-xs font-semibold text-gray-500">{task.estimated_hours}h</span>
          </div>

          {/* Real */}
          <div className="flex items-center">
            <span className={`text-xs font-bold ${overBudget ? 'text-rose-500' : 'text-gray-700'}`}>
              {(task.actual_hours ?? 0).toFixed(1)}h
            </span>
          </div>

          {/* Health badge */}
          <div className="flex items-center">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border ${health.color}`}>
              {health.label}
            </span>
          </div>

          {/* Timer action */}
          <div className="flex items-center justify-end gap-1.5">
            {task.status !== 'completed' && (
              activeTimerTaskId === task.id ? (
                <button type="button" onClick={() => handleStopTimer(task.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors" title="Detener">
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button type="button" onClick={() => handleStartTimer(task.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition-colors opacity-0 group-hover:opacity-100" title="Iniciar">
                  <Play size={13} fill="currentColor" />
                </button>
              )
            )}
            <button type="button" onClick={() => openTaskModal(task)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100" title="Editar">
              <Plus size={13} className="rotate-45" />
            </button>
          </div>
        </div>

        {/* Subtasks (expanded) - rendered inline, no component redefinition */}
        {isExpanded && sub.map(st => renderTaskRow(st, true))}

        {/* Add subtask row */}
        {isExpanded && !isSubtask && (
          <div key={`add-${task.id}`} className="pl-16 pr-5 py-2.5 border-b border-gray-50 bg-gray-50/20">
            <button
              type="button"
              onClick={() => openTaskModal(null, task.id)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#4449AA] font-bold transition-colors"
            >
              <Plus size={12} /> Agregar subtarea
            </button>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 animate-in fade-in duration-300 pb-12">

      {/* Demo Mode Banner */}
      {!dbAvailable && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-700 text-xs font-medium">
          <AlertCircle size={14} className="shrink-0 text-amber-500" />
          <span><strong>Demo Local</strong> — Tablas aún no migradas en Supabase. Los cambios persisten en tu navegador.</span>
        </div>
      )}

      {/* ── HEADER ROW ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4449AA] to-[#6c71e8] flex items-center justify-center shadow-lg shadow-indigo-900/20 shrink-0">
            <Layers size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-[#4449AA] tracking-tight leading-none">Gestión de Proyectos</h1>
            <p className="text-xs text-gray-500 font-semibold mt-1">Control de tiempo · Seguimiento de tareas · Cumplimiento</p>
          </div>
        </div>

        {/* Right: Project selector + New Project */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            className="h-9 md:h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#4449AA]/20 max-w-[180px] cursor-pointer"
            value={selectedProjectId}
            onChange={(e) => { setSelectedProjectId(e.target.value); localStorage.setItem('last_project_id', e.target.value); loadTasks(e.target.value); }}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="h-9 md:h-10 px-4 flex items-center gap-1.5 bg-white border border-gray-200 hover:border-[#4449AA]/40 hover:text-[#4449AA] text-gray-600 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* ── METRICS GRID ────────────────────────────────── */}
      {selectedProjectId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { 
              icon: <CheckCircle2 size={16} className="text-[#4449AA]" />, 
              bg: 'bg-[#4449AA]/10',
              label: 'Completadas', 
              value: `${metrics.completedCount}/${tasks.length}`, 
              sub: `${metrics.progressPercent.toFixed(0)}% completado`,
              progress: metrics.progressPercent
            },
            { 
              icon: <ListTodo size={16} className="text-blue-500" />, 
              bg: 'bg-blue-50',
              label: 'Tiempo Planificado', 
              value: `${metrics.totalEst.toFixed(1)}h`, 
              sub: 'Total estimaciones',
              progress: null 
            },
            { 
              icon: <Clock size={16} className="text-violet-500" />, 
              bg: 'bg-violet-50',
              label: 'Tiempo Ejecutado', 
              value: `${metrics.totalAct.toFixed(1)}h`, 
              sub: 'Total horas logueadas',
              progress: null 
            },
            { 
              icon: <BarChart4 size={16} className={metrics.totalAct > metrics.totalEst ? 'text-rose-500' : 'text-emerald-500'} />, 
              bg: metrics.totalAct > metrics.totalEst ? 'bg-rose-50' : 'bg-emerald-50',
              label: 'Eficiencia', 
              value: `${metrics.totalEst > 0 ? ((metrics.totalAct / metrics.totalEst) * 100).toFixed(0) : 0}%`, 
              sub: metrics.totalAct > metrics.totalEst ? 'Desviación de tiempo' : 'Dentro del presupuesto',
              progress: null 
            },
          ].map((m, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{m.label}</p>
                  <p className="text-xl md:text-2xl font-black text-gray-900 mt-1">{m.value}</p>
                </div>
                <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center shrink-0`}>
                  {m.icon}
                </div>
              </div>
              <div className="mt-3">
                {m.progress !== null ? (
                  <div className="space-y-1.5">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#4449AA] to-indigo-400 transition-all duration-700"
                        style={{ width: `${m.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold">{m.sub}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 font-bold">{m.sub}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIVE TIMER BANNER ──────────────────────────── */}
      {activeTimerTaskId && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-900 to-[#2e3187] border border-indigo-900/40 shadow-lg shadow-indigo-900/10 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 animate-pulse">
              <Clock size={16} className="text-indigo-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tiempo en ejecución</p>
              <p className="text-sm font-bold text-white truncate leading-tight mt-0.5">{tasks.find(t => t.id === activeTimerTaskId)?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-lg font-black text-white tracking-widest">{formatTimer(timerSeconds)}</span>
            <button
              onClick={() => handleStopTimer(activeTimerTaskId)}
              className="flex items-center gap-1.5 px-4 h-9 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
            >
              <Square size={11} fill="white" /> Detener
            </button>
          </div>
        </div>
      )}

      {/* ── FILTER + VIEW TOOLBAR ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Buscar tarea..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 h-9 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:bg-white transition-all"
          />
        </div>

        {/* Priority chips */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-100 p-1">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'urgent', label: '🔥 Urgentes' },
            { key: 'high', label: '⚡ Altas' },
            { key: 'medium', label: 'Media' },
            { key: 'low', label: 'Baja' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPriorityFilter(p.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${priorityFilter === p.key ? 'bg-white text-[#4449AA] shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5">
          {[
            { status: 'todo', label: 'Pendiente', dot: 'bg-slate-400' },
            { status: 'in_progress', label: 'En Curso', dot: 'bg-blue-500' },
            { status: 'completed', label: 'Listo', dot: 'bg-emerald-500' },
          ].map(s => {
            const count = tasks.filter(t => t.status === s.status).length;
            return (
              <div key={s.status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-500">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                {s.label}
                <span className="text-gray-400 font-black">{count}</span>
              </div>
            );
          })}
        </div>

        {/* View Toggle + CTA */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex rounded-xl bg-gray-50 p-1 border border-gray-100">
            <button onClick={() => setViewMode('kanban')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-white text-[#4449AA] shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}><KanbanSquare size={13} className="inline mr-1" />Kanban</button>
            <button onClick={() => setViewMode('list')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-[#4449AA] shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}><ListTodo size={13} className="inline mr-1" />Lista</button>
            <button onClick={() => setViewMode('timeline')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-white text-[#4449AA] shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}><BarChart4 size={13} className="inline mr-1" />Gantt</button>
          </div>
          <button
            onClick={() => openTaskModal()}
            className="flex items-center gap-2 h-9 px-4 bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-900/10"
          >
            <Plus size={14} /> Nueva Tarea
          </button>
        </div>
      </div>

      {/* Notion Board (Kanban) View */}
      {viewMode === 'kanban' && (
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          
          {/* Columns */}
          {(['todo', 'in_progress', 'paused', 'completed'] as Task['status'][]).map(status => {
            const statusTasks = filteredTasks.filter(t => t.status === status);
            const columnsConfig = {
              todo: { title: 'Pendientes', color: 'bg-slate-100 text-slate-700 border-slate-200' },
              in_progress: { title: 'En Progreso', color: 'bg-blue-50 text-blue-700 border-blue-100' },
              paused: { title: 'Pausadas', color: 'bg-amber-50 text-amber-700 border-amber-100' },
              completed: { title: 'Completadas', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
            };
            const config = columnsConfig[status];

            return (
              <div key={status} className="bg-gray-50/50 p-5 rounded-2xl border border-gray-200/60 flex flex-col space-y-4 min-h-[550px]">
                <div className="flex items-center justify-between border-b border-gray-200/60 pb-2.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${config.color}`}>
                    {config.title} ({statusTasks.length})
                  </span>
                </div>

                <div className="flex flex-col space-y-3.5 overflow-y-auto max-h-[70vh] pr-1">
                  {statusTasks.length === 0 ? (
                    <div className="p-10 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400 text-xs font-medium bg-white/40">
                      Vacío
                    </div>
                  ) : (
                    statusTasks.map(task => {
                      const efficiency = getDeviations(task);
                      const assigned = getAssignedProfile(task.assigned_to);

                      return (
                        <div
                          key={task.id}
                          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 relative group"
                        >
                          {/* Priority & Health Badges */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                                task.priority === 'high' ? 'bg-amber-100 text-amber-600' :
                                task.priority === 'medium' ? 'bg-indigo-50 text-indigo-500' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {task.priority}
                              </span>
                              
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${efficiency.color}`}>
                                {efficiency.label}
                              </span>
                            </div>

                            {/* Dropdown status shift */}
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateStatus(task.id, e.target.value as Task['status'])}
                              className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-transparent border-0 focus:ring-0 outline-none cursor-pointer hover:text-[#4449AA]"
                            >
                              <option value="todo">Pendiente</option>
                              <option value="in_progress">En Progreso</option>
                              <option value="paused">Pausar</option>
                              <option value="completed">Completada</option>
                            </select>
                          </div>

                          {/* Task Content */}
                          {task.parent_task_id && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md mb-2">
                              Subtarea de: {tasks.find(t => t.id === task.parent_task_id)?.title || 'Tarea principal'}
                            </span>
                          )}
                          <h4 
                            onClick={() => openTaskModal(task)}
                            className="font-bold text-sm text-gray-800 hover:text-[#4449AA] cursor-pointer line-clamp-2 leading-snug mb-1.5"
                          >
                            {task.title}
                          </h4>
                          {task.checklist && task.checklist.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2.5">
                              <CheckCircle2 size={13} className={task.checklist.every(c => c.status === 'passed') ? "text-emerald-500" : "text-indigo-400"} />
                              <span>{task.checklist.filter(c => c.status === 'passed').length}/{task.checklist.length} pruebas</span>
                            </div>
                          )}
                          {task.description && (
                            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                              {task.description}
                            </p>
                          )}

                          {/* Time progress bar */}
                          <div className="space-y-1.5 mb-4">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-400 font-medium">Uso Horas</span>
                              <span className="text-gray-700 font-bold">{(task.actual_hours ?? 0).toFixed(1)}h / {task.estimated_hours ?? 0}h</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  (task.actual_hours ?? 0) > (task.estimated_hours ?? 0)
                                    ? (efficiency.ratio > 120 ? 'bg-rose-500' : 'bg-amber-500')
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(((task.actual_hours ?? 0) / (task.estimated_hours || 1)) * 100, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Footer details */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                            {/* Assigned Profile */}
                            <div className="flex items-center gap-2">
                              {assigned ? (
                                <>
                                  {assigned.avatar_url ? (
                                    <img src={assigned.avatar_url} alt={assigned.full_name || 'Usuario'} className="w-6 h-6 rounded-full object-cover" />
                                  ) : (
                                    <span className="w-6 h-6 rounded-full bg-[#4449AA]/10 text-[#4449AA] flex items-center justify-center text-[10px] font-bold">
                                      {(assigned.full_name || assigned.email || 'U').charAt(0)}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500 font-semibold">{(assigned.full_name || assigned.email || 'Usuario').split(' ')[0]}</span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 flex items-center gap-1"><User size={11} /> Sin asignar</span>
                              )}
                            </div>

                            {/* Timer actions */}
                            <div className="flex items-center gap-1">
                              {task.status !== 'completed' && (
                                activeTimerTaskId === task.id ? (
                                  <button
                                    onClick={() => handleStopTimer(task.id)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors"
                                    title="Detener tiempo"
                                  >
                                    <Square size={13} fill="currentColor" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleStartTimer(task.id)}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-500 transition-colors"
                                    title="Iniciar tiempo"
                                  >
                                    <Play size={13} fill="currentColor" />
                                  </button>
                                )
                              )}
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Eliminar"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

        </section>
      )}

      {/* ── NOTION-STYLE LIST VIEW ── */}
      {viewMode === 'list' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-[minmax(0,1fr)_130px_150px_100px_90px_90px_110px_95px] border-b border-gray-100 bg-gray-50/60 px-5 py-3">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Tarea</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Responsable</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Estado</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Prioridad</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Est.</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Real</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Salud</span>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">⏱</span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Layers size={32} />
              <p className="text-xs font-semibold mt-3">No hay tareas que coincidan</p>
            </div>
          ) : parentTasks.map(task => renderTaskRow(task))}
        </section>
      )}


      {/* ── PREMIUM GANTT / TIMELINE VIEW ────────────────────────── */}
      {viewMode === 'timeline' && (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const dow = today.getDay();
        const anchorMonday = new Date(today);
        anchorMonday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow) + ganttWeekOffset * 7);

        const formatHours = (h?: number | null) => {
          if (!h || h <= 0) return '0h';
          const hrs = Math.floor(h);
          const mins = Math.round((h - hrs) * 60);
          if (mins === 0) return `${hrs}h`;
          return `${hrs}h ${mins}m`;
        };

        const WEEKS = 10, DAYS = WEEKS * 7, DAY_W = 36, ROW_H = 58, LEFT_W = 480;

        const days: Date[] = Array.from({ length: DAYS }, (_, i) => {
          const d = new Date(anchorMonday); d.setDate(anchorMonday.getDate() + i); return d;
        });
        const weeks = Array.from({ length: WEEKS }, (_, w) => {
          const wd = days.slice(w * 7, w * 7 + 7);
          return { label: `Sem ${wd[0].getDate()}/${wd[0].getMonth()+1}`, days: wd };
        });

        const ganttStart = new Date(anchorMonday);
        const ganttEnd   = new Date(anchorMonday); ganttEnd.setDate(anchorMonday.getDate() + DAYS);
        const todayOff   = Math.round((today.getTime() - ganttStart.getTime()) / 86400000);
        const showToday  = todayOff >= 0 && todayOff < DAYS;

        const SC: Record<string, { tw: string; hex: string }> = {
          todo:             { tw: 'bg-slate-400',   hex: '#94a3b8' },
          in_progress:      { tw: 'bg-blue-500',    hex: '#3b82f6' },
          paused:           { tw: 'bg-amber-400',   hex: '#f59e0b' },
          pending_approval: { tw: 'bg-violet-500',  hex: '#8b5cf6' },
          rejected:         { tw: 'bg-rose-500',    hex: '#ef4444' },
          completed:        { tw: 'bg-emerald-500', hex: '#10b981' },
        };

        const PB: Record<string, string> = {
          urgent: 'border-l-[3px] border-rose-500',
          high:   'border-l-[3px] border-amber-500',
          medium: 'border-l-[3px] border-indigo-400',
          low:    'border-l-[3px] border-gray-300',
        };

        const calcBar = (task: Task) => {
          const ov = ganttDragOverride[task.id];
          const hasStart = !!task.start_date, hasEnd = !!task.due_date;
          let rs: Date;
          if (hasStart)    rs = new Date(task.start_date!);
          else if (hasEnd) { rs = new Date(task.due_date!); rs.setDate(rs.getDate() - Math.max(1, Math.ceil((task.estimated_hours ?? 8) / 8))); }
          else             rs = new Date(today);
          let re: Date;
          if (hasEnd)                                   re = new Date(task.due_date!);
          else if (task.estimated_hours && task.estimated_hours > 0) { re = new Date(rs); re.setDate(rs.getDate() + Math.max(1, Math.ceil(task.estimated_hours / 8))); }
          else                                          { re = new Date(rs); re.setDate(rs.getDate() + 3); }
          const s = new Date(rs); s.setHours(0,0,0,0);
          const e = new Date(re); e.setHours(0,0,0,0);
          const cs = s < ganttStart ? ganttStart : s;
          const ce = e > ganttEnd   ? ganttEnd   : e;
          if (cs >= ganttEnd || ce <= ganttStart) return null;
          const off = Math.max(0, Math.round((cs.getTime() - ganttStart.getTime()) / 86400000));
          const dur = Math.max(1, Math.round((ce.getTime() - cs.getTime()) / 86400000) + 1);
          const base = { left: ov ? ov.left : off * DAY_W, width: ov ? ov.width : dur * DAY_W, isFallback: !hasEnd, origStart: s, origEnd: e };
          return base;
        };

        const startBarDrag = (e: React.MouseEvent, task: Task, type: 'move' | 'resize') => {
          e.preventDefault(); e.stopPropagation();
          const bar = calcBar(task); if (!bar) return;
          document.body.style.cursor = type === 'resize' ? 'ew-resize' : 'grabbing';
          document.body.style.userSelect = 'none';
          ganttDragRef.current = { type, taskId: task.id, startX: e.clientX, origLeft: bar.left, origWidth: bar.width, origStartDate: bar.origStart, origEndDate: bar.origEnd, dayW: DAY_W };
        };

        const startRowDrag = (e: React.MouseEvent, task: Task) => {
          e.preventDefault();
          document.body.style.cursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%238b5cf6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5'/><path d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6'/><path d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v9'/><path d='M6 14.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6c0 5.5 4.5 10 10 10h1a10 10 0 0 0 10-10v-3.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2V12'/></svg>") 12 12, grabbing`;
          document.body.style.userSelect = 'none';
          setGanttRowDragging(task.id);
          ganttRowDragRef.current = { taskId: task.id, startY: e.clientY, currentIdx: 0 };
        };

        // Sort parents by ganttTaskOrder if set
        const allParents = filteredTasks.filter(t => !t.parent_task_id);
        const parents = ganttTaskOrder.length
          ? [...allParents].sort((a, b) => {
              const ai = ganttTaskOrder.indexOf(a.id); const bi = ganttTaskOrder.indexOf(b.id);
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            })
          : allParents;
        const childrenOf = (pid: string) => filteredTasks.filter(t => t.parent_task_id === pid);

        const renderBar = (task: Task) => {
          const bar = calcBar(task); if (!bar) return null;
          const sc   = SC[task.status] ?? SC.todo;
          const pct  = task.estimated_hours && task.estimated_hours > 0 ? Math.min(((task.actual_hours ?? 0) / task.estimated_hours) * 100, 100) : 0;
          const isFb = bar.isFallback;
          return (
            <div
              className={`absolute top-1/2 -translate-y-1/2 rounded-full group/bar select-none cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow ${isFb ? 'opacity-55' : 'opacity-95'}`}
              style={{ left: bar.left + 3, width: Math.max(bar.width - 6, DAY_W), height: 28 }}
              onMouseDown={(e) => startBarDrag(e, task, 'move')}
            >
              {/* Solid bar background using status color */}
              <div className="absolute inset-0 rounded-full" style={{ backgroundColor: sc.hex, opacity: 0.85 }} />
              {/* dashed for fallback */}
              {isFb && <div className="absolute inset-0 rounded-full" style={{ border: '2px dashed rgba(255, 255, 255, 0.4)' }} />}
              {/* progress fill as a darker overlay */}
              {!isFb && pct > 0 && (
                <div className="absolute top-0 left-0 bottom-0 rounded-full bg-black/20 transition-all" style={{ width: `${pct}%` }} />
              )}
              {/* label: always white and drop-shadowed for maximum contrast */}
              <div className="relative h-full flex items-center px-2.5 gap-1 overflow-hidden">
                <span className="text-[9px] font-black truncate whitespace-nowrap text-white drop-shadow-sm">{task.title}</span>
                {!isFb && pct > 0 && <span className="text-[8px] text-white/80 font-bold shrink-0">{Math.round(pct)}%</span>}
              </div>
              {/* resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize rounded-r-full opacity-0 group-hover/bar:opacity-100 flex items-center justify-center gap-0.5 transition-opacity"
                onMouseDown={(e) => { e.stopPropagation(); startBarDrag(e, task, 'resize'); }}
              >
                <div className="w-0.5 h-3.5 rounded-full bg-white/50" />
                <div className="w-0.5 h-3.5 rounded-full bg-white/50" />
              </div>
            </div>
          );
        };

        const renderGanttBg = (h: number) => (
          <>
            {days.map((d, di) => (d.getDay()===0||d.getDay()===6) && <div key={di} className="absolute inset-y-0 bg-gray-50/80" style={{ left: di*DAY_W, width: DAY_W }} />)}
            {days.map((_,di) => <div key={`gl${di}`} className="absolute inset-y-0 w-px bg-gray-100/70" style={{ left: di*DAY_W }} />)}
            {showToday && <div className="absolute inset-y-0 w-0.5 bg-indigo-500/70 z-10" style={{ left: todayOff*DAY_W }} />}
          </>
        );

        return (
          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden" style={{ userSelect: 'none' }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-[#4449AA] flex items-center justify-center shadow-md shadow-indigo-200">
                  <BarChart4 size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-gray-900 leading-none">Timeline del Proyecto</p>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{filteredTasks.length} tareas · arrastra barras (←→) o filas (↑↓)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 mr-2 pr-3 border-r border-gray-100">
                  <div className="flex items-center gap-1.5"><div className="w-7 h-2.5 rounded-full bg-blue-500 opacity-80"/><span className="text-[9px] font-bold text-gray-400">Con fecha</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-7 h-2.5 rounded-full border-2 border-dashed border-gray-300"/><span className="text-[9px] font-bold text-gray-400">Estimada</span></div>
                </div>
                <button onClick={() => setGanttWeekOffset(0)} className="px-3 h-7 text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all shadow-sm shadow-indigo-200">Hoy</button>
                <button onClick={() => setGanttWeekOffset(g => g-1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"><ChevronRight size={13} className="rotate-180"/></button>
                <button onClick={() => setGanttWeekOffset(g => g+1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"><ChevronRight size={13}/></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div style={{ minWidth: LEFT_W + DAYS * DAY_W }}>
                {/* Header */}
                <div className="flex sticky top-0 z-20 border-b-2 border-gray-200 bg-white">
                  <div className="shrink-0 flex items-end px-3 pb-2 border-r border-gray-200 bg-gray-50/80 text-[9px] font-black text-gray-400 uppercase tracking-widest gap-2" style={{ width: LEFT_W }}>
                    <div className="flex-1 text-left">Tarea</div>
                    <div className="w-[80px] shrink-0 border-l border-gray-200 pl-2 text-left">Asignado</div>
                    <div className="w-[60px] shrink-0 border-l border-gray-200 pl-2 text-right">Horas</div>
                  </div>
                  <div className="flex" style={{ width: DAYS * DAY_W }}>
                    {weeks.map((w, wi) => (
                      <div key={wi} className="border-r border-gray-200" style={{ width: 7 * DAY_W }}>
                        <div className="px-2 py-1 text-[9px] font-black text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">{w.label}</div>
                        <div className="flex">
                          {w.days.map((d, di) => {
                            const isT = d.toDateString() === today.toDateString();
                            const isW = d.getDay() === 0 || d.getDay() === 6;
                            return (
                              <div key={di} style={{ width: DAY_W }}
                                className={`py-1 text-center text-[9px] font-bold border-r border-gray-50 ${isT ? 'bg-indigo-500 text-white rounded-t-md' : isW ? 'bg-gray-100/80 text-gray-400' : 'bg-white text-gray-400'}`}>
                                {['D','L','M','X','J','V','S'][d.getDay()]}
                                <div className={`text-[8px] leading-none ${isT ? 'text-indigo-100' : ''}`}>{d.getDate()}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                {filteredTasks.length === 0 ? (
                  <div className="py-20 text-center text-gray-300"><Layers size={36} className="mx-auto mb-3 opacity-30"/><p className="text-xs font-semibold">No hay tareas</p></div>
                ) : parents.map(parent => {
                  const children  = childrenOf(parent.id);
                  const expanded  = ganttExpandedGroups.has(parent.id);
                  const assigned  = getAssignedProfile(parent.assigned_to);
                  const sc        = SC[parent.status] ?? SC.todo;
                  const isDragTarget = ganttRowDragOver === parent.id;

                  return (
                    <React.Fragment key={parent.id}>
                      {/* Parent row */}
                      <div
                        data-gantt-row={parent.id}
                        className={`flex border-b border-gray-100 group/row transition-all duration-150 ${PB[parent.priority] ?? ''} ${isDragTarget ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : 'hover:bg-slate-50/60'}`}
                        style={{ height: ROW_H }}
                      >
                        {/* Left panel */}
                        <div className="shrink-0 flex items-center px-2 border-r border-gray-100 bg-white gap-2" style={{ width: LEFT_W }}>
                          {/* Col 1: Tarea */}
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {/* Row drag handle */}
                            <div
                              className={`transition-all shrink-0 w-6 h-6 rounded-md flex items-center justify-center
                                ${ganttRowDragging === parent.id
                                  ? 'text-white bg-indigo-500 shadow-lg shadow-indigo-200 ring-2 ring-indigo-300'
                                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              style={{
                                cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%238b5cf6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5'/><path d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6'/><path d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v9'/><path d='M6 14.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6c0 5.5 4.5 10 10 10h1a10 10 0 0 0 10-10v-3.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2V12'/></svg>") 12 12, grab`
                              }}
                              onMouseDown={(e) => startRowDrag(e, parent)}
                              title="Arrastrar para reordenar"
                            >
                              <GripVertical size={14} />
                            </div>
                            {/* Chevron */}
                            <button
                              onClick={() => setGanttExpandedGroups(p => { const n = new Set(p); n.has(parent.id) ? n.delete(parent.id) : n.add(parent.id); return n; })}
                              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all ${children.length > 0 ? 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer' : 'opacity-0 pointer-events-none'}`}
                            >
                              {children.length > 0 && <ChevronRight size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />}
                            </button>
                            {/* Status dot */}
                            <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: sc.hex }} />
                            {/* Title & Info & Edit */}
                            <div className="min-w-0 flex-1 flex items-center gap-1.5 group/title">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-gray-800 truncate leading-snug">{parent.title}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${priorCfg[parent.priority]}`}>{parent.priority}</span>
                                  {parent.due_date
                                    ? <span className="text-[8px] text-gray-400 font-semibold">{new Date(parent.due_date).toLocaleDateString('es',{day:'2-digit',month:'short'})}</span>
                                    : <span className="text-[8px] text-amber-500 font-bold">sin fecha</span>
                                  }
                                  {children.length > 0 && <span className="text-[8px] text-indigo-400 font-black">{children.length} subtareas</span>}
                                </div>
                              </div>
                              <button onClick={() => openTaskModal(parent)} className="opacity-0 group-hover/row:opacity-100 w-6 h-6 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 flex items-center justify-center transition-all shrink-0" title="Editar">
                                <Pencil size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Col 2: Asignado */}
                          <div className="w-[80px] shrink-0 border-l border-gray-100 pl-2 flex items-center justify-start">
                            {assigned ? (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold shadow-sm ring-1 ring-white" title={assigned.full_name ?? assigned.email}>
                                {(assigned.full_name ?? assigned.email)[0].toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-[9px]" title="Sin asignar">
                                +
                              </div>
                            )}
                          </div>

                          {/* Col 3: Horas */}
                          <div className="w-[60px] shrink-0 border-l border-gray-100 pl-2 text-right text-[10px] font-semibold text-gray-500">
                            {formatHours(parent.actual_hours)}
                          </div>
                        </div>
                        {/* Gantt area */}
                        <div className="relative overflow-hidden" style={{ width: DAYS * DAY_W, height: ROW_H }}>
                          {renderGanttBg(ROW_H)}
                          {renderBar(parent)}
                        </div>
                      </div>

                      {/* Children (collapsed by default) */}
                      {expanded && (() => {
                        const subtaskIds = ganttSubtaskOrder[parent.id] ?? [];
                        const sortedChildren = subtaskIds.length
                          ? [...children].sort((a, b) => {
                              const ai = subtaskIds.indexOf(a.id); const bi = subtaskIds.indexOf(b.id);
                              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                            })
                          : children;
                        return sortedChildren.map(child => {
                          const ca  = getAssignedProfile(child.assigned_to);
                          const csc = SC[child.status] ?? SC.todo;
                          const isDragTarget = ganttRowDragOver === child.id;
                          return (
                            <div
                              key={child.id}
                              data-gantt-row={child.id}
                              className={`flex border-b border-gray-50 group/row transition-all ${PB[child.priority] ?? ''}
                                ${isDragTarget ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : 'hover:bg-blue-50/20 bg-gray-50/40'}`}
                              style={{ height: ROW_H - 10 }}
                            >
                              <div className="shrink-0 flex items-center px-2 border-r border-gray-100 bg-white gap-2" style={{ width: LEFT_W }}>
                                {/* Col 1: Tarea */}
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                  {/* indent line */}
                                  <div className="w-4 shrink-0 flex justify-center relative self-stretch">
                                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-indigo-200/60" />
                                    <div className="absolute top-1/2 left-1/2 w-2 h-px bg-indigo-200/60" />
                                  </div>
                                  {/* Row drag handle for child task */}
                                  <div
                                    className={`transition-all shrink-0 w-5 h-5 rounded flex items-center justify-center
                                      ${ganttRowDragging === child.id
                                        ? 'text-white bg-indigo-500 shadow-md shadow-indigo-200 ring-2 ring-indigo-300'
                                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    style={{
                                      cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%238b5cf6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5'/><path d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6'/><path d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v9'/><path d='M6 14.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6c0 5.5 4.5 10 10 10h1a10 10 0 0 0 10-10v-3.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2V12'/></svg>") 12 12, grab`
                                    }}
                                    onMouseDown={(e) => startRowDrag(e, child)}
                                    title="Arrastrar para reordenar subtarea"
                                  >
                                    <GripVertical size={11} />
                                  </div>
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: csc.hex, opacity: 0.8 }} />
                                  {/* Title & Info & Edit */}
                                  <div className="min-w-0 flex-1 flex items-center gap-1.5 group/title">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-semibold text-gray-600 truncate">{child.title}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded ${priorCfg[child.priority]}`}>{child.priority}</span>
                                        {child.due_date
                                          ? <span className="text-[8px] text-gray-400 font-semibold">{new Date(child.due_date).toLocaleDateString('es',{day:'2-digit',month:'short'})}</span>
                                          : <span className="text-[8px] text-amber-400 font-bold">sin fecha</span>
                                        }
                                      </div>
                                    </div>
                                    <button onClick={() => openTaskModal(child)} className="opacity-0 group-hover/row:opacity-100 w-5 h-5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-400 flex items-center justify-center transition-all shrink-0"><Pencil size={10}/></button>
                                  </div>
                                </div>

                                {/* Col 2: Asignado */}
                                <div className="w-[80px] shrink-0 border-l border-gray-100 pl-2 flex items-center justify-start">
                                  {ca ? (
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[8px] font-bold shadow-sm ring-1 ring-white" title={ca.full_name ?? ca.email}>
                                      {(ca.full_name ?? ca.email)[0].toUpperCase()}
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-[8px]" title="Sin asignar">
                                      +
                                    </div>
                                  )}
                                </div>

                                {/* Col 3: Horas */}
                                <div className="w-[60px] shrink-0 border-l border-gray-100 pl-2 text-right text-[10px] font-semibold text-gray-500">
                                  {formatHours(child.actual_hours)}
                                </div>
                              </div>
                            <div className="relative overflow-hidden" style={{ width: DAYS * DAY_W, height: ROW_H - 10 }}>
                              {renderGanttBg(ROW_H - 10)}
                              {renderBar(child)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}




      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="Crear Nuevo Proyecto" className="max-w-md">
        <form onSubmit={handleCreateProject} className="space-y-6 p-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nombre del Proyecto</label>
            <Input
              placeholder="Ej: Migración ERP Gasolineras"
              value={newProject.name}
              onChange={e => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full p-3.5 h-auto bg-gray-50/50 border-gray-200/80 rounded-xl text-[13px] font-medium focus-visible:ring-4 focus-visible:ring-[#4449AA]/10 focus-visible:border-[#4449AA]/40 shadow-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Descripción</label>
            <textarea
              placeholder="Detalles sobre el proyecto o planificación..."
              value={newProject.description}
              onChange={e => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-[13px] font-medium text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#4449AA]/40 focus:ring-4 focus:ring-[#4449AA]/10 transition-all shadow-sm min-h-[100px]"
            />
          </div>
          <div className="flex gap-3 pt-6">
            <Button
              type="button"
              onClick={() => setIsProjectModalOpen(false)}
              className="w-full bg-gray-100/80 text-gray-600 hover:bg-gray-200 border border-gray-200/50 h-12 text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full bg-[#4449AA] hover:bg-[#383d8f] text-white border-0 h-12 text-xs font-bold uppercase tracking-widest rounded-xl shadow-md shadow-indigo-900/20 transition-all active:scale-[0.98]"
            >
              Crear Proyecto
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Slide-over Task Drawer ── */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsTaskModalOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Premium Dark Header */}
            <div className="bg-[#26285A] text-white shrink-0 shadow-sm relative z-10">
               <div className="flex items-start justify-between px-6 pt-6 pb-4">
                  <div>
                    <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5" />
                      {selectedTask ? 'Editar Tarea' : 'Nueva Tarea'}
                    </div>
                    <h3 className="font-black text-white text-xl leading-tight">
                      {selectedTask?.title || 'Borrador de Tarea'}
                    </h3>
                  </div>
                  <button onClick={() => setIsTaskModalOpen(false)} className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                     <X size={18} />
                  </button>
               </div>

               {/* Tabs inside Header */}
               <div className="flex px-6 gap-6 pt-2">
                  <button 
                     type="button"
                     onClick={() => setTaskTab('details')}
                     className={`pb-3 text-[11px] font-bold uppercase tracking-widest border-b-[3px] transition-all flex items-center gap-2 ${taskTab === 'details' ? 'border-white text-white' : 'border-transparent text-indigo-200/60 hover:text-indigo-200'}`}
                  >
                    Detalles
                  </button>
                  <button 
                     type="button"
                     onClick={() => setTaskTab('qa')}
                     className={`pb-3 text-[11px] font-bold uppercase tracking-widest border-b-[3px] transition-all flex items-center gap-2 ${taskTab === 'qa' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-indigo-200/60 hover:text-indigo-200'}`}
                  >
                    QA Checklist
                    {taskForm.checklist && taskForm.checklist.length > 0 && (
                       <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${taskTab === 'qa' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/60'}`}>
                         {taskForm.checklist.filter(c => c.status === 'passed').length}/{taskForm.checklist.length}
                       </span>
                    )}
                  </button>
               </div>
            </div>

            {/* Form wrapping the body and footer */}
            <form onSubmit={handleSaveTask} className="flex flex-col flex-1 overflow-hidden">
              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                 {taskTab === 'details' ? (
                   <div className="space-y-5 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nombre de la Tarea</label>
                        <Input
                          placeholder="Ej: B2-1: Optimización de Facturación"
                          value={taskForm.title}
                          onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                          className="w-full p-3.5 h-auto bg-gray-50/50 border-gray-200/80 rounded-xl text-[13px] font-medium focus-visible:ring-4 focus-visible:ring-[#4449AA]/10 focus-visible:border-[#4449AA]/40 shadow-sm"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Descripción / Detalles Técnicos</label>
                        <textarea
                          placeholder="Detalles de la implementación, algoritmos, etc..."
                          value={taskForm.description}
                          onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                          className="w-full p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-[13px] font-medium text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#4449AA]/40 focus:ring-4 focus:ring-[#4449AA]/10 transition-all shadow-sm min-h-[100px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Asignar A</label>
                          <select
                            value={taskForm.assigned_to}
                            onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                            className="w-full p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-[13px] font-medium text-gray-800 outline-none focus:bg-white focus:border-[#4449AA]/40 focus:ring-4 focus:ring-[#4449AA]/10 transition-all shadow-sm cursor-pointer"
                          >
                            <option value="">Sin Asignar</option>
                            {profiles.map(p => (
                              <option key={p.id} value={p.id}>{p.full_name || p.email || 'Sin nombre'}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tarea Principal (Padre)</label>
                          <select
                            value={taskForm.parent_task_id}
                            onChange={e => setTaskForm({ ...taskForm, parent_task_id: e.target.value })}
                            className="w-full p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-[13px] font-medium text-gray-800 outline-none focus:bg-white focus:border-[#4449AA]/40 focus:ring-4 focus:ring-[#4449AA]/10 transition-all shadow-sm cursor-pointer"
                          >
                            <option value="">Ninguna</option>
                            {tasks
                              .filter(t => !t.parent_task_id && (!selectedTask || t.id !== selectedTask.id))
                              .map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))
                            }
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Prioridad</label>
                          <select
                            value={taskForm.priority}
                            onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as Task['priority'] })}
                            className="w-full p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-[13px] font-medium text-gray-800 outline-none focus:bg-white focus:border-[#4449AA]/40 focus:ring-4 focus:ring-[#4449AA]/10 transition-all shadow-sm cursor-pointer"
                          >
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Estimación (Horas)</label>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="4.0"
                            value={taskForm.estimated_hours}
                            onChange={e => setTaskForm({ ...taskForm, estimated_hours: Number(e.target.value) })}
                            className="w-full p-3.5 h-auto bg-gray-50/50 border-gray-200/80 rounded-xl text-[13px] font-medium focus-visible:ring-4 focus-visible:ring-[#4449AA]/10 focus-visible:border-[#4449AA]/40 shadow-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Fecha Límite</label>
                          <Input
                            type="date"
                            value={taskForm.due_date}
                            onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                            className="w-full p-3.5 h-auto bg-gray-50/50 border-gray-200/80 rounded-xl text-[13px] font-medium focus-visible:ring-4 focus-visible:ring-[#4449AA]/10 focus-visible:border-[#4449AA]/40 shadow-sm"
                          />
                        </div>
                      </div>
                   </div>
                 ) : (() => {
                    // Derived values for QA tab
                    const est  = selectedTask?.estimated_hours ?? taskForm.estimated_hours ?? 0;
                    const act  = selectedTask?.actual_hours ?? 0;
                    const pct  = est > 0 ? Math.min((act / est) * 100, 150) : 0;
                    const over = act > est && est > 0;
                    const passed  = taskForm.checklist.filter(c => c.status === 'passed').length;
                    const failed  = taskForm.checklist.filter(c => c.status === 'failed').length;
                    const pending = taskForm.checklist.filter(c => c.status === 'pending').length;
                    const allPass = taskForm.checklist.length > 0 && passed === taskForm.checklist.length;
                    const isSupervisor = profile?.role === 'company_admin' || profile?.role === 'super_admin';
                    const taskStatus  = selectedTask?.status ?? 'todo';

                    return (
                    <div className="space-y-5 animate-in fade-in duration-300">

                      {/* ── TIME COMPARISON WIDGET ── */}
                      <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Clock size={12} className="text-indigo-400" /> Tiempo & Rendimiento
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Estimado</p>
                            <p className="text-xl font-black text-gray-800 mt-0.5">{est}h</p>
                          </div>
                          <div className={`rounded-xl border p-3 text-center shadow-sm ${over ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Ejecutado</p>
                            <p className={`text-xl font-black mt-0.5 ${over ? 'text-rose-600' : 'text-emerald-700'}`}>{act.toFixed(1)}h</p>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-[10px] text-gray-400 font-semibold">{pct.toFixed(0)}% del presupuesto</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${over ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {over ? '⚠ Sobre presupuesto' : est === 0 ? '—' : '✓ En rango'}
                          </span>
                        </div>
                      </div>

                      {/* ── REJECTION BANNER ── */}
                      {taskStatus === 'rejected' && selectedTask?.rejection_reason && (
                        <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertCircle size={14} className="text-rose-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Tarea Rechazada</p>
                            <p className="text-xs text-rose-700 mt-0.5 font-medium">{selectedTask.rejection_reason}</p>
                            <p className="text-[10px] text-rose-400 mt-1">Corrige los errores y vuelve a enviar para aprobación.</p>
                          </div>
                        </div>
                      )}

                      {/* ── PENDING APPROVAL BANNER ── */}
                      {taskStatus === 'pending_approval' && (
                        <div className="flex items-start gap-3 p-3.5 bg-violet-50 border border-violet-200 rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles size={14} className="text-violet-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">En Revisión del Supervisor</p>
                            <p className="text-xs text-violet-700 mt-0.5">
                              Enviada el {selectedTask?.submitted_at ? new Date(selectedTask.submitted_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── APPROVED BANNER ── */}
                      {taskStatus === 'completed' && selectedTask?.approved_by && (
                        <div className="flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">✓ Aprobada por Supervisor</p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              {selectedTask?.approved_at ? new Date(selectedTask.approved_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── TEST CASES ── */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Casos de Prueba</p>
                            <div className="flex items-center gap-1">
                              {passed  > 0 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{passed} ✓</span>}
                              {failed  > 0 && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">{failed} ✗</span>}
                              {pending > 0 && <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{pending} ○</span>}
                            </div>
                          </div>
                          {taskStatus !== 'completed' && taskStatus !== 'pending_approval' && (
                            <button
                              type="button"
                              onClick={() => setTaskForm(prev => ({
                                ...prev,
                                checklist: [...(prev.checklist || []), { id: `chk-${Date.now()}`, text: '', status: 'pending' }]
                              }))}
                              className="text-xs text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Añadir
                            </button>
                          )}
                        </div>

                        {taskForm.checklist.length > 0 ? (
                          <div className="space-y-2">
                            {taskForm.checklist.map((item, idx) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 group px-3 py-2.5 rounded-xl border transition-all ${
                                  item.status === 'passed' ? 'bg-emerald-50/60 border-emerald-200/60' :
                                  item.status === 'failed' ? 'bg-rose-50/60 border-rose-200/60' :
                                  'bg-white border-gray-100 hover:border-gray-200'
                                }`}
                              >
                                {/* Pass / Fail buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={taskStatus === 'completed' || taskStatus === 'pending_approval'}
                                    onClick={() => handleChecklistItemChange(idx, 'status', item.status === 'passed' ? 'pending' : 'passed')}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                      item.status === 'passed'
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-600'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title="Marcar como PASADO"
                                  ><Check size={12} /></button>
                                  <button
                                    type="button"
                                    disabled={taskStatus === 'completed' || taskStatus === 'pending_approval'}
                                    onClick={() => handleChecklistItemChange(idx, 'status', item.status === 'failed' ? 'pending' : 'failed')}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                      item.status === 'failed'
                                        ? 'bg-rose-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-400 hover:bg-rose-100 hover:text-rose-600'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title="Marcar como FALLIDO (auto-rechaza)"
                                  ><X size={12} /></button>
                                </div>

                                {/* Test description */}
                                <input
                                  type="text"
                                  placeholder="Ej: Validar guardado en BD"
                                  value={item.text}
                                  disabled={taskStatus === 'completed' || taskStatus === 'pending_approval'}
                                  onChange={e => handleChecklistItemChange(idx, 'text', e.target.value)}
                                  className={`flex-1 bg-transparent text-[13px] outline-none px-1 transition-all disabled:cursor-default ${
                                    item.status === 'passed' ? 'line-through text-emerald-700/70 font-medium' :
                                    item.status === 'failed' ? 'text-rose-700 font-semibold' :
                                    'text-gray-700'
                                  }`}
                                />

                                {/* Status badge */}
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                                  item.status === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                                  item.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                                  'bg-gray-100 text-gray-400'
                                }`}>
                                  {item.status === 'passed' ? 'Pasó' : item.status === 'failed' ? 'Falló' : 'Pendiente'}
                                </span>

                                {/* Delete */}
                                {taskStatus !== 'completed' && taskStatus !== 'pending_approval' && (
                                  <button
                                    type="button"
                                    onClick={() => setTaskForm({ ...taskForm, checklist: taskForm.checklist.filter(c => c.id !== item.id) })}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-rose-500 rounded-lg transition-all"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <CheckCircle2 size={24} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-[13px] text-gray-400 font-medium mb-3">Sin casos de prueba aún</p>
                            <button
                              type="button"
                              onClick={() => setTaskForm(prev => ({
                                ...prev,
                                checklist: [...(prev.checklist || []), { id: `chk-${Date.now()}`, text: '', status: 'pending' }]
                              }))}
                              className="text-xs bg-indigo-50 text-indigo-600 font-bold px-4 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 mx-auto"
                            >
                              <Plus size={12} /> Agregar Caso de Prueba
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── WORKFLOW ACTION SECTION ── */}
                      {selectedTask && taskStatus !== 'completed' && (
                        <div className="border-t border-gray-100 pt-4 space-y-3">

                          {/* Developer: Submit for approval */}
                          {taskStatus !== 'pending_approval' && (
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                Flujo de Aprobación
                              </p>
                              <div className="flex items-center gap-2 mb-3">
                                {['Desarrollo', 'Tests', 'Revisión', 'Aprobado'].map((step, i) => {
                                  const stepActive = i === 0 ? true : i === 1 ? taskForm.checklist.length > 0 : i === 2 ? allPass : false;
                                  return (
                                    <React.Fragment key={step}>
                                      <div className={`flex items-center gap-1.5 ${stepActive ? 'opacity-100' : 'opacity-30'}`}>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${stepActive ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{i + 1}</div>
                                        <span className={`text-[9px] font-bold ${stepActive ? 'text-gray-700' : 'text-gray-400'}`}>{step}</span>
                                      </div>
                                      {i < 3 && <div className={`flex-1 h-px ${stepActive ? 'bg-indigo-200' : 'bg-gray-100'}`} />}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={handleSubmitForApproval}
                                disabled={!allPass || taskForm.checklist.length === 0}
                                className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-900/10 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                <Sparkles size={14} />
                                {allPass ? 'Enviar para Aprobación del Supervisor' : failed > 0 ? 'Corrige los tests fallidos primero' : pending > 0 ? `Completa ${pending} test(s) pendiente(s)` : 'Agrega casos de prueba primero'}
                              </button>
                            </div>
                          )}

                          {/* Supervisor: Approve / Reject panel */}
                          {isSupervisor && (
                            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-violet-500 flex items-center justify-center">
                                  <Sparkles size={13} className="text-white" />
                                </div>
                                <div>
                                  <p className="text-[11px] font-black text-violet-800 uppercase tracking-widest">
                                    {taskStatus === 'pending_approval' ? 'Revisión del Supervisor' : 'Control de Supervisor (Acceso Directo)'}
                                  </p>
                                  <p className="text-[10px] text-violet-500">
                                    {taskStatus === 'pending_approval' ? 'Revisa los tests y aprueba o rechaza' : 'Aprueba o rechaza directamente esta tarea'}
                                  </p>
                                </div>
                              </div>
                              {taskForm.checklist.length === 0 && (
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                                  <p className="text-[10px] text-amber-700">Sin casos de prueba documentados — se aprobará sin evidencia QA</p>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleApproveTask}
                                  className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                >
                                  <CheckCircle2 size={14} /> Aprobar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRejectTask}
                                  disabled={!rejectionInput.trim()}
                                  className="flex-1 h-10 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                                >
                                  <AlertCircle size={14} /> Rechazar
                                </button>
                              </div>
                              <textarea
                                placeholder="Motivo del rechazo (obligatorio para rechazar)..."
                                value={rejectionInput}
                                onChange={e => setRejectionInput(e.target.value)}
                                rows={2}
                                className="w-full p-3 bg-white border border-violet-200 rounded-xl text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                              />
                            </div>
                          )}

                          {/* Developer: Waiting for approval */}
                          {!isSupervisor && taskStatus === 'pending_approval' && (
                            <div className="text-center py-3 text-[11px] text-gray-400 font-medium">
                              Esperando revisión del supervisor
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                    );
                 })()}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-gray-100 bg-gray-50/80 shrink-0">
                 <div className="flex gap-3">
                    <Button 
                      type="button" 
                      onClick={() => setIsTaskModalOpen(false)} 
                      className="w-full bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 h-12 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-sm"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="w-full bg-[#4449AA] hover:bg-[#383d8f] text-white border-0 h-12 text-xs font-bold uppercase tracking-widest rounded-xl shadow-md shadow-indigo-900/20 transition-all active:scale-[0.98]"
                    >
                      {selectedTask ? "Guardar Cambios" : "Crear Tarea"}
                    </Button>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
