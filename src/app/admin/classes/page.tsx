"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Library, Users, User, Plus, Loader2, BookOpen, Pencil, Trash2, GraduationCap, X, Save, School, Calendar, Check, Clock, Info, Palette } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

interface TeacherProfile {
  id: string;
  full_name: string;
}

interface ClassAssignment {
  profiles: TeacherProfile | null;
}

interface ScheduleSlot {
  subject: string;
  time: string;
  teacher: string;
  color: string;
}

interface DaySchedule {
  day: string;
  slots: ScheduleSlot[];
}

interface ClassData {
  id: string;
  school_id: string;
  name: string;
  grade_level: string;
  created_at: string;
  teacher_class_assignments: ClassAssignment[];
  enrollments: { count: number }[];
}

const COLOR_OPTIONS = [
  { name: "Blue", key: "blue", class: "from-blue-500 to-indigo-600 bg-blue-500/10 text-blue-500 text-blue-300 border-blue-500/30" },
  { name: "Purple", key: "purple", class: "from-purple-500 to-pink-600 bg-purple-500/10 text-purple-500 text-purple-300 border-purple-500/30" },
  { name: "Amber", key: "amber", class: "from-amber-500 to-orange-600 bg-amber-500/10 text-amber-500 text-amber-300 border-amber-500/30" },
  { name: "Teal", key: "teal", class: "from-teal-500 to-emerald-600 bg-teal-500/10 text-teal-500 text-teal-300 border-teal-500/30" },
  { name: "Rose", key: "rose", class: "from-rose-500 to-red-600 bg-rose-500/10 text-rose-500 text-rose-300 border-rose-500/30" },
  { name: "Cyan", key: "cyan", class: "from-cyan-500 to-blue-600 bg-cyan-500/10 text-cyan-500 text-cyan-300 border-cyan-500/30" },
  { name: "Indigo", key: "indigo", class: "from-indigo-500 to-purple-600 bg-indigo-500/10 text-indigo-500 text-indigo-300 border-indigo-500/30" },
  { name: "Emerald", key: "emerald", class: "from-emerald-500 to-teal-600 bg-emerald-500/10 text-emerald-500 text-emerald-300 border-emerald-500/30" },
  { name: "Orange", key: "orange", class: "from-orange-500 to-red-600 bg-orange-500/10 text-orange-500 text-orange-300 border-orange-500/30" },
  { name: "Pink", key: "pink", class: "from-pink-500 to-rose-600 bg-pink-500/10 text-pink-500 text-pink-300 border-pink-500/30" }
];

const getColorClasses = (colorKey: string) => {
  const match = COLOR_OPTIONS.find(o => o.key === colorKey);
  return match || COLOR_OPTIONS[6]; // Indigo fallback
};

export default function AdminClassesPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Selected class for edit/delete
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);

  // Form states
  const [formData, setFormData] = useState({ name: "", grade_level: "10", teacher_id: "" });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // School configuration state
  const [schoolName, setSchoolName] = useState("");
  const [schoolColor, setSchoolColor] = useState("indigo");
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolColor, setNewSchoolColor] = useState("indigo");
  const [savingSchool, setSavingSchool] = useState(false);

  // Dynamic system settings dictionary
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Student list & class roster management
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [selectedAddStudentId, setSelectedAddStudentId] = useState("");

  // Edit Class Modal tabs state: "general" | "roster" | "schedule"
  const [activeTab, setActiveTab] = useState<"general" | "roster" | "schedule">("general");

  // Form color picker state for classes
  const [classColorForm, setClassColorForm] = useState("indigo");

  // Schedule management states
  const [scheduleData, setScheduleData] = useState<DaySchedule[]>([]);
  const [activeSchedDayIndex, setActiveSchedDayIndex] = useState(0);
  const [showAddSlotForm, setShowAddSlotForm] = useState(false);
  const [newSlot, setNewSlot] = useState({
    timeStart: "08:00",
    timeEnd: "09:30",
    subject: "",
    teacher: "",
    color: "blue"
  });

  const loadData = async () => {
    const supabase = createClient();
    
    // Get the admin's school_id
    const { data: { user } } = await supabase.auth.getUser();
    let sId = null;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      sId = profile?.school_id;
    }
    
    // Fallback to first school if not assigned
    if (!sId) {
      const { data: school } = await supabase.from("schools").select("id").limit(1).single();
      sId = school?.id;
    }
    
    if (!sId) {
      setLoading(false);
      return;
    }

    setSchoolId(sId);

    // Fetch school name details
    const { data: schoolObj } = await supabase.from("schools").select("name").eq("id", sId).single();
    if (schoolObj) {
      setSchoolName(schoolObj.name);
      setNewSchoolName(schoolObj.name);
    }

    // Fetch classes scoped to school
    const { data: cData } = await supabase
      .from("classes")
      .select(`
        *,
        teacher_class_assignments(
          profiles(id, full_name)
        ),
        enrollments(count)
      `)
      .eq("school_id", sId)
      .order("name");

    // Fetch all teachers for dropdown
    const { data: tData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "teacher")
      .eq("school_id", sId)
      .order("full_name");

    // Fetch all students for enrollment roster
    const { data: sData } = await supabase
      .from("profiles")
      .select("id, full_name, email, username")
      .eq("role", "student")
      .eq("school_id", sId)
      .order("full_name");

    // Fetch all system settings for school
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("school_id", sId);

    if (cData) setClasses(cData as unknown as ClassData[]);
    if (tData) setTeachers(tData as TeacherProfile[]);
    if (sData) setAllStudents(sData);
    
    const settingsMap: Record<string, string> = {};
    if (settingsData) {
      settingsData.forEach(item => {
        settingsMap[item.key] = item.value;
      });
      setSettings(settingsMap);
      const sColor = settingsMap[`school_color_code_${sId}`] || "indigo";
      setSchoolColor(sColor);
      setNewSchoolColor(sColor);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateSchoolSettings = async () => {
    if (!newSchoolName || !schoolId) return;
    setSavingSchool(true);
    const supabase = createClient();

    // 1. Update school name in schools table
    const { error: schoolError } = await supabase
      .from("schools")
      .update({ name: newSchoolName })
      .eq("id", schoolId);

    if (schoolError) {
      toast.error("Failed to update school name: " + schoolError.message);
      setSavingSchool(false);
      return;
    }

    // 2. Update school color code in system_settings
    const schoolColorKey = `school_color_code_${schoolId}`;
    const { data: existingSetting } = await supabase
      .from("system_settings")
      .select("id")
      .eq("school_id", schoolId)
      .eq("key", schoolColorKey)
      .maybeSingle();

    let settingError;
    if (existingSetting) {
      const res = await supabase
        .from("system_settings")
        .update({ value: newSchoolColor })
        .eq("id", existingSetting.id);
      settingError = res.error;
    } else {
      const res = await supabase
        .from("system_settings")
        .insert({
          school_id: schoolId,
          key: schoolColorKey,
          value: newSchoolColor
        });
      settingError = res.error;
    }

    if (settingError) {
      toast.error("Failed to save school color: " + settingError.message);
    } else {
      toast.success("School configuration updated successfully!");
      setIsEditingSchool(false);
      await loadData();
    }
    setSavingSchool(false);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.grade_level || !formData.teacher_id) {
      setErrorMsg(t.adminClasses?.fillFields || "Please fill in all fields.");
      return;
    }
    
    if (!schoolId) {
      setErrorMsg(t.adminClasses?.schoolNotFound || "School configuration not found.");
      return;
    }
    
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();
    
    // 1. Insert class row
    const { data: newClass, error: classError } = await supabase
      .from("classes")
      .insert({
        school_id: schoolId,
        name: formData.name,
        grade_level: formData.grade_level
      })
      .select()
      .single();
      
    if (classError) {
      setErrorMsg(classError.message);
      setSaving(false);
      return;
    }
    
    // 2. Assign teacher in the join table
    if (newClass && formData.teacher_id) {
      const { error: assignError } = await supabase
        .from("teacher_class_assignments")
        .insert({
          class_id: newClass.id,
          teacher_id: formData.teacher_id
        });
        
      if (assignError) {
        toast.error("Class created but failed to assign teacher: " + assignError.message);
      }
      
      // Save default color and empty schedule for the new class
      const classColorKey = `class_color_code_${newClass.id}`;
      await supabase
        .from("system_settings")
        .insert({
          school_id: schoolId,
          key: classColorKey,
          value: "indigo"
        });

      const classScheduleKey = `class_schedule_${newClass.id}`;
      const defaultSched = [
        { day: "Monday", slots: [] },
        { day: "Tuesday", slots: [] },
        { day: "Wednesday", slots: [] },
        { day: "Thursday", slots: [] },
        { day: "Friday", slots: [] }
      ];
      await supabase
        .from("system_settings")
        .insert({
          school_id: schoolId,
          key: classScheduleKey,
          value: JSON.stringify(defaultSched)
        });

      toast.success("Class created successfully!");
    }
    
    await loadData();
    setShowAddModal(false);
    setFormData({ name: "", grade_level: "10", teacher_id: "" });
    setSaving(false);
  };

  const handleOpenEdit = async (cls: ClassData) => {
    setSelectedClass(cls);
    setActiveTab("general");
    
    const assignedTeacherId = cls.teacher_class_assignments?.[0]?.profiles?.id || "";
    setFormData({
      name: cls.name,
      grade_level: cls.grade_level || "10",
      teacher_id: assignedTeacherId
    });
    
    // Class color code configuration
    const colorKey = settings[`class_color_code_${cls.id}`] || "indigo";
    setClassColorForm(colorKey);

    // Schedule configuration
    const scheduleStr = settings[`class_schedule_${cls.id}`];
    let schedParsed = [];
    if (scheduleStr) {
      try {
        schedParsed = JSON.parse(scheduleStr);
      } catch (err) {
        console.error("Failed to parse schedule JSON", err);
      }
    } else {
      // Fallback default mock slots if there is no configuration in system_settings
      schedParsed = [
        { day: "Monday", slots: [
          { time: "08:00 - 09:30", subject: "Mathematics", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "blue" },
          { time: "09:45 - 11:15", subject: "Science", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "purple" }
        ]},
        { day: "Tuesday", slots: [
          { time: "08:00 - 09:30", subject: "English Literature", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "amber" },
          { time: "09:45 - 11:15", subject: "World History", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "teal" }
        ]},
        { day: "Wednesday", slots: [
          { time: "08:00 - 09:30", subject: "Science Lab", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "purple" },
          { time: "09:45 - 11:15", subject: "Creative Arts", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "rose" }
        ]},
        { day: "Thursday", slots: [
          { time: "08:00 - 09:30", subject: "Mathematics", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "blue" },
          { time: "09:45 - 11:15", subject: "English Composition", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "amber" }
        ]},
        { day: "Friday", slots: [
          { time: "08:00 - 09:30", subject: "Physical Education", teacher: "Coach Carter", color: "cyan" },
          { time: "09:45 - 11:15", subject: "Weekly Review & Quiz", teacher: cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Teacher", color: "indigo" }
        ]}
      ];
    }
    setScheduleData(schedParsed);
    setActiveSchedDayIndex(0);
    setShowAddSlotForm(false);

    // Fetch enrolled students
    setLoadingRoster(true);
    const supabase = createClient();
    const { data: enrData } = await supabase
      .from("enrollments")
      .select("id, student_id, profiles!student_id(id, full_name, email, username)")
      .eq("class_id", cls.id);
    
    if (enrData) {
      const formatted = enrData.map((e: any) => ({
        enrollment_id: e.id,
        id: e.student_id,
        full_name: e.profiles?.full_name || "Unknown",
        email: e.profiles?.email || "",
        username: e.profiles?.username || ""
      }));
      setEnrolledStudents(formatted);
    } else {
      setEnrolledStudents([]);
    }
    setLoadingRoster(false);

    setErrorMsg("");
    setShowEditModal(true);
  };

  const handleRemoveStudent = async (studentId: string, enrollmentId: string) => {
    if (!confirm("Are you sure you want to unenroll this student from the class?")) return;
    setLoadingRoster(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("enrollments")
      .delete()
      .eq("id", enrollmentId);
    
    if (error) {
      toast.error("Failed to remove student: " + error.message);
    } else {
      toast.success("Student removed successfully!");
      setEnrolledStudents(prev => prev.filter(s => s.id !== studentId));
      await loadData();
    }
    setLoadingRoster(false);
  };

  const handleAddStudent = async () => {
    if (!selectedAddStudentId || !selectedClass) return;
    setLoadingRoster(true);
    const supabase = createClient();
    
    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", selectedAddStudentId)
      .maybeSingle();

    let error;
    if (existing) {
      const res = await supabase
        .from("enrollments")
        .update({ class_id: selectedClass.id })
        .eq("student_id", selectedAddStudentId);
      error = res.error;
    } else {
      const res = await supabase
        .from("enrollments")
        .insert({
          student_id: selectedAddStudentId,
          class_id: selectedClass.id
        });
      error = res.error;
    }

    if (error) {
      toast.error("Failed to enroll student: " + error.message);
    } else {
      toast.success("Student enrolled successfully!");
      const { data: enrData } = await supabase
        .from("enrollments")
        .select("id, student_id, profiles!student_id(id, full_name, email, username)")
        .eq("class_id", selectedClass.id);
      
      if (enrData) {
        const formatted = enrData.map((e: any) => ({
          enrollment_id: e.id,
          id: e.student_id,
          full_name: e.profiles?.full_name || "Unknown",
          email: e.profiles?.email || "",
          username: e.profiles?.username || ""
        }));
        setEnrolledStudents(formatted);
      }
      setSelectedAddStudentId("");
      await loadData();
    }
    setLoadingRoster(false);
  };

  const handleAddScheduleSlot = () => {
    if (!newSlot.subject || !newSlot.timeStart || !newSlot.timeEnd) {
      toast.error("Please fill in subject and time fields.");
      return;
    }
    const timeRange = `${newSlot.timeStart} - ${newSlot.timeEnd}`;
    const updated = [...scheduleData];
    updated[activeSchedDayIndex].slots.push({
      time: timeRange,
      subject: newSlot.subject,
      teacher: newSlot.teacher || "Unassigned",
      color: newSlot.color
    });
    setScheduleData(updated);
    setNewSlot({
      timeStart: "08:00",
      timeEnd: "09:30",
      subject: "",
      teacher: "",
      color: "blue"
    });
    setShowAddSlotForm(false);
    toast.success("Slot added to day!");
  };

  const handleRemoveScheduleSlot = (slotIdx: number) => {
    const updated = [...scheduleData];
    updated[activeSchedDayIndex].slots.splice(slotIdx, 1);
    setScheduleData(updated);
    toast.success("Slot removed.");
  };

  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!formData.name || !formData.grade_level) {
      setErrorMsg(t.adminClasses?.fillFields || "Please fill in all fields.");
      return;
    }
    
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();
    
    // 1. Update class details
    const { error: updateError } = await supabase
      .from("classes")
      .update({
        name: formData.name,
        grade_level: formData.grade_level
      })
      .eq("id", selectedClass.id);
      
    if (updateError) {
      setErrorMsg(updateError.message);
      setSaving(false);
      return;
    }
    
    // 2. Update teacher assignment
    await supabase.from("teacher_class_assignments").delete().eq("class_id", selectedClass.id);
    
    if (formData.teacher_id) {
      const { error: assignError } = await supabase
        .from("teacher_class_assignments")
        .insert({
          class_id: selectedClass.id,
          teacher_id: formData.teacher_id
        });
        
      if (assignError) {
        toast.error("Class updated but failed to update teacher: " + assignError.message);
      }
    }

    // 3. Save class color code setting
    const classColorKey = `class_color_code_${selectedClass.id}`;
    const { data: existingColorSetting } = await supabase
      .from("system_settings")
      .select("id")
      .eq("school_id", schoolId)
      .eq("key", classColorKey)
      .maybeSingle();

    if (existingColorSetting) {
      await supabase
        .from("system_settings")
        .update({ value: classColorForm })
        .eq("id", existingColorSetting.id);
    } else {
      await supabase
        .from("system_settings")
        .insert({
          school_id: schoolId,
          key: classColorKey,
          value: classColorForm
        });
    }

    // 4. Save class schedule setting
    const classScheduleKey = `class_schedule_${selectedClass.id}`;
    const scheduleJsonStr = JSON.stringify(scheduleData);
    
    const { data: existingScheduleSetting } = await supabase
      .from("system_settings")
      .select("id")
      .eq("school_id", schoolId)
      .eq("key", classScheduleKey)
      .maybeSingle();

    if (existingScheduleSetting) {
      await supabase
        .from("system_settings")
        .update({ value: scheduleJsonStr })
        .eq("id", existingScheduleSetting.id);
    } else {
      await supabase
        .from("system_settings")
        .insert({
          school_id: schoolId,
          key: classScheduleKey,
          value: scheduleJsonStr
        });
    }
    
    toast.success("Class configurations saved successfully!");
    await loadData();
    setShowEditModal(false);
    setSelectedClass(null);
    setSaving(false);
  };

  const handleOpenDelete = (cls: ClassData) => {
    setSelectedClass(cls);
    setShowDeleteModal(true);
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    setSaving(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", selectedClass.id);
      
    if (error) {
      toast.error("Failed to delete class: " + error.message);
    } else {
      // Remove class settings keys too
      await supabase.from("system_settings").delete().eq("school_id", schoolId).in("key", [
        `class_color_code_${selectedClass.id}`,
        `class_schedule_${selectedClass.id}`
      ]);
      toast.success("Class deleted successfully!");
      await loadData();
    }
    
    setShowDeleteModal(false);
    setSelectedClass(null);
    setSaving(false);
  };

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const eligibleStudents = allStudents.filter(s => !enrolledStudents.some(es => es.id === s.id));

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Library className="h-5 w-5 text-indigo-500" /> {t.adminClasses?.title || "Class Management"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {interpolate(t.adminClasses?.activeClasses || "Active classes: {count}", { count: classes.length })}
          </p>
        </div>
        <button 
          onClick={() => {
            setFormData({ name: "", grade_level: "10", teacher_id: "" });
            setErrorMsg("");
            setShowAddModal(true);
          }}
          className={`flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all shadow-lg bg-gradient-to-r ${getColorClasses(schoolColor).class.split(" ").slice(0, 2).join(" ")}`}
        >
          <Plus className="h-4 w-4" /> {t.adminClasses?.addClass || "Add Class"}
        </button>
      </div>

      {/* School Configuration Panel */}
      <div className="card rounded-2xl p-5 border border-border/50 bg-card overflow-hidden relative shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${getColorClasses(schoolColor).class.split(" ").slice(0, 2).join(" ")} text-white flex items-center justify-center`}>
              <School className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-base flex items-center gap-2 text-foreground">
                {schoolName || "SMA Nusantara"}
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20">
                  School Portal Config
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure school-wide theme coloring and metadata. Students will view this branding.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setNewSchoolName(schoolName);
              setNewSchoolColor(schoolColor);
              setIsEditingSchool(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all shrink-0 border border-border/40"
          >
            <Palette className="h-3.5 w-3.5 text-muted-foreground" /> Configure School
          </button>
        </div>

        {/* Edit School Settings Modal */}
        {isEditingSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <School className="h-5 w-5 text-primary" /> Edit School Settings
                </h3>
                <button onClick={() => setIsEditingSchool(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">School Name</label>
                  <input 
                    required
                    type="text" 
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">School Theme Color</label>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_OPTIONS.map((opt) => {
                      const colorParts = opt.class.split(" ");
                      const bgGradient = `bg-gradient-to-br ${colorParts.slice(0, 2).join(" ")}`;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setNewSchoolColor(opt.key)}
                          title={opt.name}
                          className={`h-9 rounded-xl flex items-center justify-center text-white cursor-pointer transition-all relative ${bgGradient} ${
                            newSchoolColor === opt.key ? "ring-2 ring-offset-2 ring-primary scale-[1.05]" : "opacity-80 hover:opacity-100"
                          }`}
                        >
                          {newSchoolColor === opt.key && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/65">
                <button 
                  onClick={() => setIsEditingSchool(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateSchoolSettings}
                  disabled={savingSchool}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  {savingSchool && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={Library} title={t.adminClasses?.noClasses || "No Classes Found"} description={t.adminClasses?.noClassesDesc || "Create a class and assign a teacher to start tracking attendance."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const teacherName = cls.teacher_class_assignments?.[0]?.profiles?.full_name || "Unassigned";
            const classColorKey = settings[`class_color_code_${cls.id}`] || "indigo";
            const colorOption = getColorClasses(classColorKey);
            const colorParts = colorOption.class.split(" ");
            const bgGradient = `bg-gradient-to-br ${colorParts.slice(0, 2).join(" ")}`;
            const bgSubtle = colorParts[2];
            const textBase = colorParts[3];
            const borderSubtle = colorParts[5];

            return (
              <div key={cls.id} className={`glass rounded-2xl p-5 border border-border/50 flex flex-col justify-between h-full hover:${borderSubtle} transition-all group hover:shadow-md`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`h-10 w-10 rounded-xl ${bgGradient} flex items-center justify-center text-white`}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`${bgSubtle} ${textBase} px-2 py-0.5 rounded-md text-[10px] font-bold`}>
                        Grade {cls.grade_level || "10"}
                      </span>
                      <span className="bg-muted px-2.5 py-1 rounded-full text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3 w-3" /> {interpolate(t.adminClasses?.studentsCount || "{count} Students", { count: cls.enrollments?.[0]?.count || 0 })}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-foreground">{cls.name}</h3>
                </div>
                
                <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium min-w-0">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <span className="truncate">{teacherName}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenEdit(cls)}
                      className="p-1.5 rounded-lg bg-muted hover:bg-indigo-500/10 hover:text-indigo-500 transition-colors text-muted-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleOpenDelete(cls)}
                      className="p-1.5 rounded-lg bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="font-bold text-base flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-500" /> {t.adminClasses?.createNewClass || "Create New Class"}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{t.adminClasses?.className || "Class Name"}</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                  placeholder="e.g. XII IPA-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Grade Level</label>
                <select
                  required
                  value={formData.grade_level}
                  onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                >
                  <option value="10">Grade 10</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{t.adminClasses?.assignTeacher || "Assign Teacher"}</label>
                <select 
                  required
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                >
                  <option value="" disabled>{t.adminClasses?.selectTeacher || "Select a teacher"}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              {errorMsg && <p className="text-xs font-medium text-destructive bg-destructive/10 p-3 rounded-xl">{errorMsg}</p>}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? t.adminClasses?.creating || "Creating..." : t.adminClasses?.createClass || "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal (Configurable Tabs for Name/Teacher, Students, and Weekly Schedules) */}
      {showEditModal && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="font-bold text-base flex items-center gap-2 text-foreground">
                <Pencil className="h-4 w-4 text-primary" /> Edit Class: <span className="text-primary">{selectedClass.name}</span>
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="px-6 border-b border-border bg-muted/10 flex gap-4 text-xs font-bold text-muted-foreground">
              <button 
                type="button" 
                onClick={() => setActiveTab("general")}
                className={`py-3 border-b-2 px-1 transition-all ${activeTab === "general" ? "border-primary text-primary font-extrabold" : "border-transparent hover:text-foreground"}`}
              >
                General Settings
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTab("roster")}
                className={`py-3 border-b-2 px-1 transition-all flex items-center gap-1.5 ${activeTab === "roster" ? "border-primary text-primary font-extrabold" : "border-transparent hover:text-foreground"}`}
              >
                <Users className="h-3.5 w-3.5" /> Student Roster ({enrolledStudents.length})
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTab("schedule")}
                className={`py-3 border-b-2 px-1 transition-all flex items-center gap-1.5 ${activeTab === "schedule" ? "border-primary text-primary font-extrabold" : "border-transparent hover:text-foreground"}`}
              >
                <Calendar className="h-3.5 w-3.5" /> Schedule Config
              </button>
            </div>
            
            <form onSubmit={handleEditClass} className="p-6 space-y-4">
              {/* Tab 1: General settings */}
              {activeTab === "general" && (
                <div className="space-y-4 min-h-[300px]">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Class Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Grade Level</label>
                    <select
                      required
                      value={formData.grade_level}
                      onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="10">Grade 10</option>
                      <option value="11">Grade 11</option>
                      <option value="12">Grade 12</option>
                      <option value="XII">Grade XII</option>
                      <option value="XI">Grade XI</option>
                      <option value="X">Grade X</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Assigned Teacher</label>
                    <select 
                      required
                      value={formData.teacher_id}
                      onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    >
                      <option value="" disabled>Select a teacher</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-2">Class Color Theme</label>
                    <div className="grid grid-cols-5 gap-2">
                      {COLOR_OPTIONS.map((opt) => {
                        const colorParts = opt.class.split(" ");
                        const bgGradient = `bg-gradient-to-br ${colorParts.slice(0, 2).join(" ")}`;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setClassColorForm(opt.key)}
                            title={opt.name}
                            className={`h-9 rounded-xl flex items-center justify-center text-white cursor-pointer transition-all relative ${bgGradient} ${
                              classColorForm === opt.key ? "ring-2 ring-offset-2 ring-primary scale-[1.05]" : "opacity-80 hover:opacity-100"
                            }`}
                          >
                            {classColorForm === opt.key && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Student Roster management */}
              {activeTab === "roster" && (
                <div className="space-y-4 min-h-[300px]">
                  {/* Enroll Student selector */}
                  <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">Add Student to Roster</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedAddStudentId}
                          onChange={(e) => setSelectedAddStudentId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                        >
                          <option value="">Select student to add...</option>
                          {eligibleStudents.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.full_name} ({st.email || st.username || "no email"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddStudent}
                        disabled={loadingRoster || !selectedAddStudentId}
                        className="px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1 shrink-0"
                      >
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>
                  </div>

                  {/* Enrolled Students list */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">Enrolled Students ({enrolledStudents.length})</label>
                    
                    {loadingRoster ? (
                      <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading roster...
                      </div>
                    ) : enrolledStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8 bg-muted/10 rounded-xl border border-dashed">
                        No students enrolled in this class yet.
                      </p>
                    ) : (
                      <div className="max-h-[190px] overflow-y-auto pr-1 space-y-1.5 border border-border/40 rounded-xl p-1.5 bg-muted/5">
                        {enrolledStudents.map((st) => (
                          <div key={st.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 hover:bg-muted/20 border border-border/30 transition-all">
                            <div className="min-w-0 pl-1">
                              <p className="text-xs font-bold text-foreground truncate">{st.full_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{st.email || st.username}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudent(st.id, st.enrollment_id)}
                              className="p-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                              title="Unenroll student"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Schedule configuration */}
              {activeTab === "schedule" && (
                <div className="space-y-4 min-h-[300px]">
                  {/* Weekday Switcher */}
                  <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
                    {["Mon", "Tue", "Wed", "Thu", "Fri"].map((dayName, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setActiveSchedDayIndex(idx);
                          setShowAddSlotForm(false);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activeSchedDayIndex === idx 
                            ? "bg-white text-foreground shadow-sm font-extrabold" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {dayName}
                      </button>
                    ))}
                  </div>

                  {/* Active day slots list */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-muted-foreground">
                        {scheduleData[activeSchedDayIndex]?.day || "Selected Day"} Slots ({scheduleData[activeSchedDayIndex]?.slots?.length || 0})
                      </label>
                      {!showAddSlotForm && (
                        <button
                          type="button"
                          onClick={() => setShowAddSlotForm(true)}
                          className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-md"
                        >
                          <Plus className="h-3 w-3" /> Add Slot
                        </button>
                      )}
                    </div>

                    {/* Add Slot sub-form */}
                    {showAddSlotForm && (
                      <div className="p-3 border border-primary/20 bg-primary/5 rounded-xl space-y-2 animate-fade-in">
                        <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Create New Schedule Slot
                        </p>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-muted-foreground">Start Time</label>
                            <input 
                              type="time" 
                              value={newSlot.timeStart}
                              onChange={(e) => setNewSlot({...newSlot, timeStart: e.target.value})}
                              className="w-full p-1.5 rounded-lg border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" 
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-muted-foreground">End Time</label>
                            <input 
                              type="time" 
                              value={newSlot.timeEnd}
                              onChange={(e) => setNewSlot({...newSlot, timeEnd: e.target.value})}
                              className="w-full p-1.5 rounded-lg border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" 
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-muted-foreground">Subject Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Mathematics"
                            value={newSlot.subject}
                            onChange={(e) => setNewSlot({...newSlot, subject: e.target.value})}
                            className="w-full p-1.5 rounded-lg border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" 
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-muted-foreground">Teacher Name</label>
                          <select
                            value={newSlot.teacher}
                            onChange={(e) => setNewSlot({...newSlot, teacher: e.target.value})}
                            className="w-full p-1.5 rounded-lg border border-border bg-white text-xs text-foreground focus:outline-none"
                          >
                            <option value="">Select or type teacher...</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.full_name}>{t.full_name}</option>
                            ))}
                            <option value="Coach Carter">Coach Carter</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-muted-foreground mb-1">Slot Color Theme</label>
                          <div className="flex gap-2">
                            {["blue", "purple", "amber", "teal", "rose", "cyan", "indigo"].map((colorKey) => {
                              const opt = getColorClasses(colorKey);
                              const colorParts = opt.class.split(" ");
                              const bgGradient = `bg-gradient-to-br ${colorParts.slice(0, 2).join(" ")}`;
                              return (
                                <button
                                  key={colorKey}
                                  type="button"
                                  onClick={() => setNewSlot({...newSlot, color: colorKey})}
                                  className={`h-5 w-5 rounded-full ${bgGradient} border border-white/20 transition-transform ${
                                    newSlot.color === colorKey ? "scale-125 ring-2 ring-offset-1 ring-primary" : "opacity-75 hover:opacity-100"
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1.5">
                          <button
                            type="button"
                            onClick={() => setShowAddSlotForm(false)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-muted rounded-md hover:bg-muted/80 text-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddScheduleSlot}
                            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                          >
                            Add Slot
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Slots List */}
                    <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                      {(!scheduleData[activeSchedDayIndex] || scheduleData[activeSchedDayIndex].slots.length === 0) ? (
                        <p className="text-xs text-muted-foreground text-center py-6 bg-muted/10 rounded-xl border border-dashed">
                          No schedule slots configured for this day.
                        </p>
                      ) : (
                        scheduleData[activeSchedDayIndex].slots.map((slot, sIdx) => {
                          const colMap = getColorClasses(slot.color);
                          const colorParts = colMap.class.split(" ");
                          const bgGradient = `bg-gradient-to-br ${colorParts.slice(0, 2).join(" ")}`;
                          const borderSubtle = colorParts[5];

                          return (
                            <div 
                              key={sIdx} 
                              className={`flex items-center justify-between p-2.5 rounded-xl bg-muted/15 border border-border/40 hover:${borderSubtle} transition-all bg-muted/5`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pl-1">
                                <div className={`h-8 w-8 rounded-lg ${bgGradient} text-white flex items-center justify-center shrink-0`}>
                                  <Clock className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground truncate">{slot.subject}</p>
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                    <span className="font-semibold">{slot.time}</span>
                                    <span className="h-1 w-1 rounded-full bg-muted-foreground/45" />
                                    <span className="truncate">{slot.teacher}</span>
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveScheduleSlot(sIdx)}
                                className="p-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {errorMsg && <p className="text-xs font-medium text-destructive bg-destructive/10 p-3 rounded-xl">{errorMsg}</p>}

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-6 space-y-4">
            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Delete Class?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-foreground">{selectedClass.name}</span>? This will unenroll all students and remove teacher assignments. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteClass}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-destructive text-white text-xs font-bold hover:bg-destructive/90 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Delete Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
