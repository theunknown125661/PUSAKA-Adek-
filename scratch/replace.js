const fs = require('fs');

const path = 'e:\\Develop\\School Streak\\src\\app\\student\\class\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
content = content.replace(
  'import AvatarDisplay from "@/components/profile/avatar-display";',
  'import AvatarDisplay from "@/components/profile/avatar-display";\nimport { ScheduleComponent } from "./schedule-component";'
);

// 2. Remove fake schedule states and add subjectLegends
content = content.replace(
  /const \[classSchedule, setClassSchedule\] = useState<DaySchedule\[\]>\(\[\]\);([\s\S]*?)const \[selectedMonthOffset, setSelectedMonthOffset\] = useState<number>\(0\);/,
  'const [subjectLegends, setSubjectLegends] = useState<any[]>([]);'
);

// 3. Remove fake schedule generation
content = content.replace(
  /\/\/ Prepopulate default schedule with current teacher's name([\s\S]*?)setClassSchedule\(loadedSchedule\);/,
  ''
);

// 4. Remove renderScheduleContent and getSubjectLegends
content = content.replace(
  /const renderScheduleContent = \(\) => \{([\s\S]*?)return Array\.from\(legendsMap\.values\(\)\);\n  \};/,
  ''
);

// 5. Replace timetable rendering
content = content.replace(
  /\{\/\* Timetable \/ Schedule \*\/\}([\s\S]*?)<\/div>\n          <\/div>/,
  `{/* Timetable / Schedule */}
          <div className="card rounded-2xl p-6 space-y-5">
            <ScheduleComponent schoolId={schoolData.id} classId={classData.id} onSubjectsChange={setSubjectLegends} />
          </div>`
);

// 6. Update subject legends loop
content = content.replace(
  /\{getSubjectLegends\(\)\.map\(\(legend, idx\) => \{/,
  '{subjectLegends.map((legend, idx) => {'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated class/page.tsx');
