


import { CreateGameForm } from "../component/admin/addQuestion";

export function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Trivia Game Admin</h1>
        </div>
        <CreateGameForm />
      </div>
    </div>
  );
}