import Foundation

struct InteriorDesignAPIClient: Sendable {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func generate(
        request: GenerateInteriorDesignRequest,
        serviceURL: URL
    ) async throws -> GenerateInteriorDesignResponse {
        let endpoint = serviceURL.appending(path: "v1/designs/generate")
        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.timeoutInterval = 180
        urlRequest.httpBody = try JSONEncoder().encode(request)

        let (data, response) = try await session.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw InteriorDesignAPIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let serverError = try? JSONDecoder().decode(ServerErrorResponse.self, from: data)
            let requestSuffix = serverError?.requestID.map { " (요청 ID: \($0))" } ?? ""
            throw InteriorDesignAPIError.server(
                (serverError?.error ?? "이미지 생성 서버 오류 (HTTP \(httpResponse.statusCode))") + requestSuffix
            )
        }

        return try JSONDecoder().decode(GenerateInteriorDesignResponse.self, from: data)
    }

    func health(serviceURL: URL) async throws -> String {
        let (data, response) = try await session.data(from: serviceURL.appending(path: "health"))
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw InteriorDesignAPIError.invalidResponse
        }
        let health = try JSONDecoder().decode(HealthResponse.self, from: data)
        return health.model
    }
}

private struct ServerErrorResponse: Decodable {
    let error: String
    let code: String?
    let requestID: String?
}

private struct HealthResponse: Decodable {
    let model: String
}

enum InteriorDesignAPIError: LocalizedError {
    case invalidServiceURL
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidServiceURL:
            "디자인 서버 주소를 확인해주세요."
        case .invalidResponse:
            "디자인 서버의 응답을 확인할 수 없습니다."
        case .server(let message):
            message
        }
    }
}
